#!/usr/bin/python
#
# Copyright 2014 Google Inc. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

#modified 2017 by Tyler
import os
from oauth2client.service_account import ServiceAccountCredentials
from apiclient.discovery import build

scopes = ['https://www.googleapis.com/auth/androidpublisher']

credentials = ServiceAccountCredentials.from_json_keyfile_name(os.environ.get('googlePlayJsonKeyfile'), scopes=scopes)

service = build('androidpublisher', 'v2', credentials=credentials)

package_name = 'com.baronbrew.tiltcordova'
apk_file = 'platforms/android/build/outputs/apk/android-release-signed.apk'

edit_request = service.edits().insert(body={}, packageName=package_name)
result = edit_request.execute()
edit_id = result['id']

apks_result = service.edits().apks().list(
    editId=edit_id, packageName=package_name).execute()

for apk in apks_result['apks']:
    print 'versionCode: %s, binary.sha1: %s' % (
        apk['versionCode'], apk['binary']['sha1'])

apk_response = service.edits().apks().upload(
    editId=edit_id,
    packageName=package_name,
    media_body=apk_file).execute()

print 'Version code %d has been uploaded' % apk_response['versionCode']

track_response = service.edits().tracks().update(
    editId=edit_id,
    track='beta',
    packageName=package_name,
    body={u'versionCodes': [apk_response['versionCode']]}).execute()

print 'Track %s is set for version code(s) %s' % (
    track_response['track'], str(track_response['versionCodes']))

commit_request = service.edits().commit(
    editId=edit_id, packageName=package_name).execute()

print 'Edit "%s" has been committed' % (commit_request['id'])
