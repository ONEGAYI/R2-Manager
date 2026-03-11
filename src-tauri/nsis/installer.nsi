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

  ; 关闭新版 sidecar 进程
  nsExec::ExecToStack `taskkill /F /IM "r2-proxy-server.exe" /T`
  Pop $0
  Pop $1

  ; 关闭旧版 sidecar 进程（兼容升级）
  nsExec::ExecToStack `taskkill /F /IM "server.exe" /T`
  Pop $0
  Pop $1

  Sleep 500  ; 确保进程完全退出
!macroend

!macro customUnInstall
  ; 卸载时关闭应用
  nsExec::ExecToStack `taskkill /F /IM "CloudflareR2 Manager.exe" /T`
  Pop $0
  Pop $1

  nsExec::ExecToStack `taskkill /F /IM "r2-proxy-server.exe" /T`
  Pop $0
  Pop $1

  Sleep 500
!macroend
