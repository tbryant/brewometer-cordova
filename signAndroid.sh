#!/bin/bash -x
rm platforms/android/build/outputs/apk/android-release-unsigned-aligned.apk
zipalign -v -p 4 platforms/android/build/outputs/apk/android-release-unsigned.apk platforms/android/build/outputs/apk/android-release-unsigned-aligned.apk
rm platforms/android/build/outputs/apk/android-release-signed.apk
apksigner sign --ks ${androidSigningKeystore} --ks-pass pass:brewometer --out platforms/android/build/outputs/apk/android-release-signed.apk platforms/android/build/outputs/apk/android-release-unsigned-aligned.apk