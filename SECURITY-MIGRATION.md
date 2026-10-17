# Firebase Authentication migration

> **Current status:** The legacy Realtime Database email/password login has been restored at the user's request. It compares passwords stored in the database and is not secure. The Firebase Authentication guidance below describes the safer migration path, not the current login behavior.

Passwords should not be stored in Realtime Database. To return to Firebase Authentication, re-enable the Firebase Auth login flow and complete the setup below before removing legacy password fields.

## One-time administrator bootstrap

Before anyone can use the migrated login, enable **Email/Password** in Firebase Console under Authentication, then migrate the first administrator:

1. Create the administrator's Firebase Authentication email/password account in Firebase Console and note its UID.
2. In Realtime Database, add `authUid` with that UID to the matching `users/admins/{userId}` record.
3. Create `authProfiles/{uid}` with `role: "admins"`, `userId: "{userId}"`, and `companyid` equal to that user record's company ID.
4. Remove the old `password` field from the user record.
5. Sign in with the exact account email and its Firebase Authentication password. The app takes the company ID from the matched database profile; it must match between the user record and `authProfiles/{uid}`.

Do not make an administrator profile publicly writable or allow users to choose their own role.

## Migrating other accounts

After the first administrator can sign in, open each legacy user in User Management and set an initial password of at least 12 characters. Saving provisions a Firebase Authentication account, links it to the existing user record, and removes any legacy plaintext password. Share that initial password through a secure channel; the user can then use **Send Password Reset Email** to choose a private password.

If an account is edited without setting an initial password, its legacy password is removed and it will not be able to sign in until it is provisioned.

## Required production access controls

This repository does not include the deployed Realtime Database rules or Firebase project deployment configuration. Firebase Authentication protects sign-in, but it does not by itself protect database reads and writes. Before treating production as secured, configure and deploy Realtime Database rules that deny unauthenticated access and enforce role, user, and company ownership for every application data path. Test the rules against all application workflows; client-side checks and `authProfiles` must not be treated as a substitute for database rules.

The browser app cannot securely delete another user's Firebase Authentication identity. Deleting an account removes its application profile and authorization link, which prevents access through this app; remove the orphaned Authentication account separately using a trusted Firebase Admin SDK environment.
