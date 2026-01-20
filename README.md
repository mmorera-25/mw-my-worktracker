# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Firebase (optional)

To add Firebase to this project:

1. Install the Firebase JS SDK:

	```
	npm install firebase
	```

2. Create a local env file (for example `.env.local`) at the project root and add your Firebase credentials using the Vite prefix `VITE_` (see `.env.example`):

	```text
	VITE_FIREBASE_API_KEY=your_api_key_here
	VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
	VITE_FIREBASE_PROJECT_ID=your_project_id
	VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
	VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
	VITE_FIREBASE_APP_ID=your_app_id
	VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
	```

3. Import the initialized services where needed:

	```ts
	// example
	import { auth, db } from './src/firebase'
	```

4. Don't commit your `.env.local` to git.

The project includes `src/firebase.ts` which reads `import.meta.env.VITE_FIREBASE_*` values and exports `app`, `auth`, and `db`.
