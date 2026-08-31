Option Explicit

Dim shell, folder, application
Set shell = CreateObject("WScript.Shell")
folder = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
application = folder & "\Kopken Menu Sync - Scheduled.exe"
shell.Run Chr(34) & application & Chr(34) & " --utama", 1, False
