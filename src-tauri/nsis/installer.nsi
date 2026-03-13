!macro customHeader
  !include "Win\Proc.nsh"
!macroend

!macro customInstall
  ; 关闭旧版本应用进程
  ${If} ${FileExists} "$INSTDIR\CloudflareR2 Manager.exe"
    nsExec::ExecToStack `taskkill /F /IM "CloudflareR2 Manager.exe" /T`
    Pop $0  ; 返回值
    Pop $1  ; 输出
    Sleep 500  ; 等待进程完全退出
  ${EndIf}

  ; 关闭新版 sidecar 进程（打包后名称）
  nsExec::ExecToStack `taskkill /F /IM "r2-proxy-server.exe" /T`
  Pop $0
  Pop $1

  ; 关闭新版 sidecar 进程（带架构后缀，开发/旧版安装包）
  nsExec::ExecToStack `taskkill /F /IM "r2-proxy-server-x86_64-pc-windows-msvc.exe" /T`
  Pop $0
  Pop $1

  ; 关闭旧版 sidecar 进程（兼容升级）
  nsExec::ExecToStack `taskkill /F /IM "server.exe" /T`
  Pop $0
  Pop $1

  ; 关闭旧版 sidecar 进程（带架构后缀）
  nsExec::ExecToStack `taskkill /F /IM "server-x86_64-pc-windows-msvc.exe" /T`
  Pop $0
  Pop $1

  Sleep 500  ; 确保进程完全退出
!macroend

!macro customUnInstall
  ; 卸载时关闭应用
  nsExec::ExecToStack `taskkill /F /IM "CloudflareR2 Manager.exe" /T`
  Pop $0
  Pop $1

  ; 关闭 sidecar 进程（多种可能的名称）
  nsExec::ExecToStack `taskkill /F /IM "r2-proxy-server.exe" /T`
  Pop $0
  Pop $1

  nsExec::ExecToStack `taskkill /F /IM "r2-proxy-server-x86_64-pc-windows-msvc.exe" /T`
  Pop $0
  Pop $1

  nsExec::ExecToStack `taskkill /F /IM "server.exe" /T`
  Pop $0
  Pop $1

  nsExec::ExecToStack `taskkill /F /IM "server-x86_64-pc-windows-msvc.exe" /T`
  Pop $0
  Pop $1

  Sleep 500
!macroend
