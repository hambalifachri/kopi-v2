Option Explicit

Dim shell, folder, runner
Set shell = CreateObject("WScript.Shell")
folder = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
runner = folder & "\run-scheduled-priority.cmd"
shell.Run "cmd.exe /d /c " & Chr(34) & runner & Chr(34), 0, False
