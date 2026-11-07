#define AppName "SIREN"
#define AppVersion "0.1.0"
#define AppPublisher "SIREN"
#define AppExeName "SIREN.exe"

[Setup]
AppId={{C10B8EB4-205A-4C1E-A68F-2C0ACD9A1591}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={localappdata}\Programs\SIREN
DefaultGroupName=SIREN
UninstallDisplayIcon={app}\{#AppExeName}
OutputDir=..\..\release
OutputBaseFilename=SIREN-Setup-{#AppVersion}-x64
SetupIconFile=siren.ico
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=lowest
Compression=lzma2
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "chinesesimplified"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加快捷方式："; Flags: unchecked

[Files]
Source: "..\..\dist\SIREN\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "MicrosoftEdgeWebview2Setup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall

[Icons]
Name: "{group}\SIREN"; Filename: "{app}\{#AppExeName}"; IconFilename: "{app}\{#AppExeName}"
Name: "{autodesktop}\SIREN"; Filename: "{app}\{#AppExeName}"; IconFilename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Run]
Filename: "{tmp}\MicrosoftEdgeWebview2Setup.exe"; Parameters: "/silent /install"; StatusMsg: "正在检查并安装 Microsoft Edge WebView2..."; Flags: waituntilterminated
Filename: "{app}\{#AppExeName}"; Description: "启动 SIREN"; Flags: postinstall nowait skipifsilent
