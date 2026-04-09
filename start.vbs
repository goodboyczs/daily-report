Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

REM 获取当前脚本目录
strPath = FSO.GetParentFolderName(WScript.ScriptFullName)
strLogFile = strPath & "\server.log"

REM 检查 server.js 是否存在
strServer = strPath & "\server.js"
If Not FSO.FileExists(strServer) Then
    Set objFile = FSO.CreateTextFile(strLogFile, True)
    objFile.WriteLine "ERROR: server.js not found at " & strServer
    objFile.Close
    WScript.Quit 1
End If

REM 在指定目录启动 Node，并把输出重定向到日志文件
REM 使用 cmd /c 确保在正确的目录运行
strCmd = "cmd /c cd /d """ & strPath & """ && node server.js >> """ & strLogFile & """ 2>&1"
WshShell.Run strCmd, 0, False

