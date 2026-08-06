# SuperClip 原型探索

独立于主项目，用于预览 UI 原型变体。此目录不依赖 `src/` 下任何业务代码，可单独构建运行。

## 预览

```bash
cd prototype
npm install      # 首次
npm run dev      # 打开 http://localhost:1430
```

> 端口 1430，与主项目 Vite dev（1420）错开，可同时运行。
> 若只想快速预览且已装过根目录依赖，`npm run dev` 也会向上解析根 `node_modules`，可跳过 `npm install`。

## 变体

| 键 | 文件 | 说明 |
|----|------|------|
| B | `variants/VariantB_Card.tsx` | Popup 磨砂卡片 · 悬浮预览 |
| D | `variants/VariantD_QuickPanel.tsx` | 快捷控制面板 Quick Panel |
| E | `variants/VariantE_Main.tsx` | 主管理台 Main |
| F | `variants/VariantF_Settings.tsx` | 设置 Settings |
| G | `variants/VariantG_Preview.tsx` | 预览窗口 Preview |

入口 `PrototypeShell` 通过 URL 参数 `?variant=B|D|E|F|G` 切换，也可用 ←/→ 键盘左右切换。

> `VariantA_Frost`、`VariantC_Split` 为早期变体，未在切换器注册，保留作历史参考。

## 构建产物

```bash
npm run build      # 产物输出到 prototype/dist
npm run preview    # 预览构建产物
```
