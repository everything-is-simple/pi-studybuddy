@echo off
setlocal
set "PI_STUDYBUDDY_TEST_PROFILE=1"
set "VITEST=1"
set "PI_STUDYBUDDY_DATA_ROOT=%LOCALAPPDATA%\PiStudyBuddy-TestProfile"
set "PI_STUDYBUDDY_PACKAGE_TASK_ID=T-M5-011-test-setup"
start "Pi StudyBuddy 方案b-setup包" "%~dp0..\..\pi-studybuddy-test.exe"
endlocal
