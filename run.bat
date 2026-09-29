@echo off
setlocal EnableExtensions
set "PROJECT_DIR=%~dp0"
pushd "%PROJECT_DIR%" >nul || exit /b 1
set "GRADLE_USER_HOME=%PROJECT_DIR%.gradle-user-home"

if not exist "%JAVA_HOME%\bin\java.exe" (
  if exist "%ProgramFiles%\Android\Android Studio\jbr\bin\java.exe" (
    set "JAVA_HOME=%ProgramFiles%\Android\Android Studio\jbr"
  ) else (
    for /f "usebackq delims=" %%J in (`powershell -NoProfile -Command "(Split-Path (Split-Path (Get-Command java).Source -Parent) -Parent)"`) do set "JAVA_HOME=%%J"
  )
)
if not exist "%JAVA_HOME%\bin\java.exe" (
  echo ERROR: Java was not found. Install JDK 17 or newer and set JAVA_HOME.
  popd
  exit /b 1
)

set "COMMAND=%~1"
if "%COMMAND%"=="" set "COMMAND=build"

if /i "%COMMAND%"=="build" goto build
if /i "%COMMAND%"=="debug" goto build
if /i "%COMMAND%"=="install" goto install
if /i "%COMMAND%"=="release" goto release
if /i "%COMMAND%"=="clean" goto clean
if /i "%COMMAND%"=="keystore" goto keystore
if /i "%COMMAND%"=="retention-test" goto rtest
if /i "%COMMAND%"=="check-signing" goto checksigning

echo Unknown command: %COMMAND%
echo Usage: run.bat [build^|install^|release^|clean^|keystore^|check-signing^|retention-test]
popd
exit /b 2

:build
call "%PROJECT_DIR%gradlew.bat" --no-daemon :app:assembleDebug
set "RESULT=%ERRORLEVEL%"
goto done

:install
call "%PROJECT_DIR%gradlew.bat" --no-daemon :app:installDebug
set "RESULT=%ERRORLEVEL%"
goto done

:release
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_DIR%scripts\release.ps1" -Mode Release
set "RESULT=%ERRORLEVEL%"
goto done

:clean
call "%PROJECT_DIR%gradlew.bat" --no-daemon clean
set "RESULT=%ERRORLEVEL%"
goto done

:keystore
echo Production signing keys are never generated or replaced automatically.
echo Copy keystore.properties.example to keystore.properties, then point storeFile
echo at a secure key you created and backed up. Replacing that key later prevents
echo Android and Obtainium from updating existing installations.
echo See BUILDING.md for the one-time keytool command and backup instructions.
set "RESULT=0"
goto done

:rtest
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_DIR%scripts\release.ps1" -Mode RetentionTest
set "RESULT=%ERRORLEVEL%"
goto done

:checksigning
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_DIR%scripts\release.ps1" -Mode CheckSigning
set "RESULT=%ERRORLEVEL%"

:done
popd
exit /b %RESULT%
