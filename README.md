# PDF・Wordファイル処理アプリ

このアプリは以下の機能を提供します：

## 機能

### 左側：PDF抽出機能
- PDFファイルのドラッグ＆ドロップ
- ページ指定での抽出（例：1,3,5-7）
- 範囲指定での抽出（開始ページ〜終了ページ）
- 最後のページ削除
- 一括処理モード

### 右側：8桁数字検索・ファイル名変換機能
- Wordファイル（.doc, .docx）のドラッグ＆ドロップ
- ファイル内のテキストから8桁の数字を自動検索
- 見つかった8桁の数字をファイル名にしてダウンロード
- 個別処理と一括処理の両方に対応

## 使用方法

1. **ローカル開発**
   ```bash
   npm install
   npm run dev
   ```
   アクセス: http://localhost:5173

2. **ネットワーク公開**
   ```bash
   npm run dev -- --host
   ```
   アクセス: http://[あなたのIP]:5173

3. **本番ビルド**
   ```bash
   npm run build
   ```

## デプロイ方法

### Netlify（推奨）
1. [Netlify](https://netlify.com)にアカウント作成
2. GitHubリポジトリと連携
3. 自動デプロイが有効になります

### Vercel
1. [Vercel](https://vercel.com)にアカウント作成
2. GitHubリポジトリと連携
3. 自動デプロイが有効になります

### GitHub Pages
1. リポジトリをGitHubにプッシュ
2. Settings > Pages でデプロイ設定
3. 自動デプロイが有効になります

## 技術スタック
- React 19
- TypeScript
- Vite
- pdf-lib（PDF処理）
- mammoth（Wordファイル処理）

## ライセンス
MIT

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      ...tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      ...tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
