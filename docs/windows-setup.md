# Windows quick setup

Follow the repository README for the complete instructions. Use Node 22.13+ and the project Python 3.12 virtual environment. Global Python 3.11 can run `python -m uv`; it is not used to run the API after setup.

On the current computer, a portable Node 22 is available at `.tools/node_modules/node/bin/node.exe`. To execute npm itself with this runtime, use:

```powershell
& 'C:\Boys_Expence\.tools\node_modules\node\bin\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' --version
```

The global `npm.cmd` can select its colocated older `node.exe` even when a different Node binary appears first in PATH. Installing the current Node LTS system-wide avoids this distinction for normal use; the project does not silently modify the global Node installation.

For the supplied computer's Android installation:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;" + $env:PATH
```

Run `scripts/build-android.ps1` after selecting the correct Node runtime. Android Studio's SDK manager may need to download the SDK/NDK/build tools selected by the generated Gradle project. A real phone needs USB debugging enabled before `adb devices` will list it. Physical-device verification requires an attached, authorized device.

Keep `.env`, `.local-data`, native signing files, backups, and QA authentication state out of source control. The release packaging script excludes them.

The config plugin automatically sets `expo.android.cmakeObjectPathMax=250` on Windows to keep generated C++ object paths compatible with the SDK Ninja binary. Keep the checkout in a short path such as `C:\Boys_Expence`. The local build script uses two Gradle workers. This does not change the Windows long-path registry policy. Use current Android command-line tools; this project currently resolves SDK platform `platforms;android-37.0`, build tools 36/37, NDK `27.1.12297006`, and CMake `3.22.1`.
