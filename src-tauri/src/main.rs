// Prevents additional console window on Windows in release
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandChild;
use tauri::Manager;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use std::thread;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use chrono::Local;

// 引入 log 插件
use tauri_plugin_log::{Target, TargetKind};

fn get_log_path() -> PathBuf {
    // 日志文件放在临时目录
    std::env::temp_dir().join("r2manager-debug.log")
}

fn log(message: &str) {
    let log_path = get_log_path();
    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S");
    let log_entry = format!("[{}] {}\n", timestamp, message);

    // 输出到控制台
    println!("{}", log_entry.trim());

    // 写入文件（追加模式）
    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
    {
        let _ = file.write_all(log_entry.as_bytes());
    }
}

/// 清空日志文件（启动时调用）
fn clear_log_file() {
    let log_path = get_log_path();
    // 使用覆写模式清空文件
    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&log_path)
    {
        let _ = file.write_all(b"");  // 清空文件
    }
}

/// Tauri 命令：前端调用写日志
#[tauri::command]
fn log_from_frontend(message: String, level: String) {
    let formatted = format!("[Frontend] [{}] {}", level.to_uppercase(), message);
    log(&formatted);
}

fn main() {
    // 清空日志文件（每次启动覆写）
    clear_log_file();

    log("=== R2 Manager Starting ===");
    log(&format!("Working dir: {:?}", std::env::current_dir().unwrap_or_default()));
    log(&format!("Exe path: {:?}", std::env::current_exe().unwrap_or_default()));

    let server_started = Arc::new(AtomicBool::new(false));
    let server_child: Arc<Mutex<Option<CommandChild>>> = Arc::new(Mutex::new(None));

    // 克隆用于 on_window_event（setup 会 move 原始变量）
    let server_child_for_close = server_child.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::Stdout),
                ])
                .build()
        )
        .invoke_handler(tauri::generate_handler![log_from_frontend])
        .setup(move |app| {
            log("Setup phase started");

            // 获取 app handle 用于日志
            let app_handle = app.handle().clone();
            let server_started_clone = server_started.clone();
            let server_child_clone = server_child.clone();

            // 在后台线程启动 sidecar
            thread::spawn(move || {
                log("[Sidecar] Waiting 500ms before start...");
                thread::sleep(Duration::from_millis(500));

                log("[Sidecar] Attempting to start server sidecar...");

                let shell = app_handle.shell();

                match shell.sidecar("server") {
                    Ok(sidecar_cmd) => {
                        log("[Sidecar] Command created successfully");

                        match sidecar_cmd.spawn() {
                            Ok((mut rx, child)) => {
                                // 保存子进程句柄以便后续清理
                                *server_child_clone.lock().unwrap() = Some(child);
                                server_started_clone.store(true, Ordering::SeqCst);
                                log("[Sidecar] Started successfully");

                                // 监听 sidecar 输出（非阻塞）
                                loop {
                                    match rx.try_recv() {
                                        Ok(event) => {
                                            match event {
                                                tauri_plugin_shell::process::CommandEvent::Stdout(line) => {
                                                    log(&format!("[Server stdout] {}", String::from_utf8_lossy(&line)));
                                                }
                                                tauri_plugin_shell::process::CommandEvent::Stderr(line) => {
                                                    log(&format!("[Server stderr] {}", String::from_utf8_lossy(&line)));
                                                }
                                                tauri_plugin_shell::process::CommandEvent::Terminated(payload) => {
                                                    log(&format!("[Server] Terminated, code: {:?}", payload.code));
                                                    break;
                                                }
                                                _ => {}
                                            }
                                        }
                                        Err(_) => {
                                            // 没有消息，休眠一下
                                            thread::sleep(Duration::from_millis(100));
                                        }
                                    }
                                }
                            }
                            Err(e) => {
                                log(&format!("[Sidecar] Failed to spawn: {}", e));
                            }
                        }
                    }
                    Err(e) => {
                        log(&format!("[Sidecar] Failed to create command: {}", e));
                    }
                }
            });

            log("Setup complete, showing window");
            Ok(())
        })
        .on_window_event(move |window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                log("[Window] CloseRequested");

                // 显式杀死 sidecar 进程
                // kill() 需要 ownership，所以用 take() 取出
                if let Ok(mut child_guard) = server_child_for_close.lock() {
                    if let Some(child) = child_guard.take() {
                        log("[Window] Killing server sidecar...");
                        match child.kill() {
                            Ok(_) => log("[Window] Server sidecar killed successfully"),
                            Err(e) => log(&format!("[Window] Failed to kill server: {}", e)),
                        }
                    }
                }

                let _ = window.app_handle().cleanup_before_exit();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
