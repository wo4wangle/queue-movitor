# plugin case

plugin case

npm run dev

## Usage

<!-- TODO: Describe usage -->

参考：https://plugins.remnote.com/

把这个 remnote 官方 plugin 示例
改成一个快捷键 plugin :

option + shift + up arrow will put the rem on the top

实际的方法：
方法 1：上传到 RemNote Marketplace（官方推荐）
确保 GitHub 仓库是公开的
在 RemNote 中：Settings → Plugins → Build 标签
点击 "Upload plugin" 按钮
上传 PluginZip.zip 文件
等待审核通过后，所有人都能在 Marketplace 安装

方法 2：其他人从 localhost 安装（开发测试用）
其他人需要：

克隆你的 GitHub 仓库
运行 npm install 和 npm run dev
在 RemNote 中 Settings → Plugins → Build → "Develop from localhost"
输入 http://localhost:8080
所以，如果你想让其他人方便地使用你的插件，唯一的方法就是上传到 RemNote Marketplace。 ZIP 文件是用来上传到 Marketplace 的，不是直接给用户安装的。

重启后需要把 plugin toggle off then on 才能 work
