# Pi StudyBuddy 方案b-setup包 Test Bundle

This directory is an explicitly opt-in test profile for the Scheme B setup
`pi-studybuddy-test--方案b-setup包.exe`.

The profile creates synthetic records in `%LOCALAPPDATA%\\PiStudyBuddy-TestProfile`
on first launch by calling the formal S1/S2 handlers. The setup does not contain a
pre-generated database, user data, credentials, DPAPI material, or external service
configuration.

`launch-test-profile.cmd` sets `PI_STUDYBUDDY_TEST_PROFILE=1`, `VITEST=1`, and the
isolated test data root before starting the installed executable. Those variables are
only for the test package and must not be used as a production launch contract.
