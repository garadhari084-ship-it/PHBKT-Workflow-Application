# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Environment Variables

This project uses environment variables for configuration, particularly for connecting to third-party services like Google AI.

1.  Create a file named `.env.local` in the root of the project by copying the template:
    ```bash
    cp .env.template .env.local
    ```
2.  Add your secret keys to `.env.local`. This file is ignored by Git and should not be committed.

### Production Environment

When you deploy your application to Firebase App Hosting, you must configure these same environment variables in the Firebase console for your backend.

Go to your Firebase project -> App Hosting -> Your Backend -> Settings, and add your `GEMINI_API_KEY` there.
