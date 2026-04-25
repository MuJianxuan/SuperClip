# Host Onboard Smoke Guide

- Generated At: 2026-04-24T16:31:14.072465+00:00
- Project: /Users/rao/AiDoWork/SuperClip
- Install Scope: project surfaces only
- Status: ok

## Codex CLI

- Status: ready
- Standard Flow First Prompt: `$super-dev`
- Competition Flow First Prompt: `$super-dev-seeai`
- Install Scope: project surfaces only

### Start Playbook
- 起手建议: 在 Codex CLI 里优先显式输入 $super-dev，不要先把 App/Desktop 的 / 列表入口和 CLI 混成一个宿主。
- 避免动作: 不要一上来先跑一串 release / proof-pack / quality 命令。

### Post-Onboard Self-Check
- Codex CLI 接入后先确认入口可用: $super-dev / super-dev: 你的需求
- Codex CLI 接入后再确认 SEEAI 项目补充面已写入: .agents/skills/super-dev-seeai/SKILL.md / plugins/super-dev-codex/skills/super-dev-seeai/SKILL.md
- Codex CLI 接入后再确认 SEEAI 用户级补充面已写入: ~/.agents/skills/super-dev-seeai/SKILL.md

### Official Workflow Checks
- 确认 Codex CLI 按 official-skill 官方协议面真实加载 Super Dev，而不是只检测到文件存在。
- 确认官方接入面真实生效: 项目侧 AGENTS.md / .agents/skills/super-dev/SKILL.md；用户侧 ~/.agents/skills/super-dev/SKILL.md
- 如启用当前增强接入面，再确认: 项目侧 .agents/plugins/marketplace.json / plugins/super-dev-codex/.codex-plugin/plugin.json；用户侧 ~/.codex/AGENTS.md
- 确认 SEEAI 项目补充面真实生效: .agents/skills/super-dev-seeai/SKILL.md / plugins/super-dev-codex/skills/super-dev-seeai/SKILL.md
- 确认 SEEAI 用户级补充面真实生效: ~/.agents/skills/super-dev-seeai/SKILL.md
- 确认当前 Codex CLI 会话里的 $super-dev 真实可用，并已读取仓库 AGENTS 与 Skills。

### Official Pass Criteria
- Codex CLI 官方工作流面、入口链、恢复链与 SEEAI 补充面均已真人验收通过。
- 确认 Codex CLI 按 official-skill 官方协议面真实加载 Super Dev，而不是只检测到文件存在。
- 确认官方接入面真实生效: 项目侧 AGENTS.md / .agents/skills/super-dev/SKILL.md；用户侧 ~/.agents/skills/super-dev/SKILL.md
- 如启用当前增强接入面，再确认: 项目侧 .agents/plugins/marketplace.json / plugins/super-dev-codex/.codex-plugin/plugin.json；用户侧 ~/.codex/AGENTS.md

### Resume Guidance
- 优先入口: $super-dev / super-dev: 你的需求
- 原生恢复: $super-dev / super-dev: 继续当前流程
- 优先沿用当前 Skill / session 入口，不要先退回普通聊天。

### Repair Playbook
-

### SEEAI Project Supplements
- `.agents/skills/super-dev-seeai/SKILL.md`
- `plugins/super-dev-codex/skills/super-dev-seeai/SKILL.md`

### SEEAI User Supplements
- `~/.agents/skills/super-dev-seeai/SKILL.md`

### Written Surfaces
- `/Users/rao/.agents/skills/super-dev`
- `/Users/rao/AiDoWork/SuperClip/.agents/plugins/marketplace.json`
- `/Users/rao/AiDoWork/SuperClip/.agents/skills/super-dev-seeai/SKILL.md`
- `/Users/rao/AiDoWork/SuperClip/.agents/skills/super-dev/SKILL.md`
- `/Users/rao/AiDoWork/SuperClip/AGENTS.md`
- `/Users/rao/AiDoWork/SuperClip/plugins/super-dev-codex/.codex-plugin/plugin.json`
- `/Users/rao/AiDoWork/SuperClip/plugins/super-dev-codex/README.md`
- `/Users/rao/AiDoWork/SuperClip/plugins/super-dev-codex/skills/super-dev-seeai/SKILL.md`
- `/Users/rao/AiDoWork/SuperClip/plugins/super-dev-codex/skills/super-dev/SKILL.md`
