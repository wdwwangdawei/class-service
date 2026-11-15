using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Text.RegularExpressions;
using System.Windows.Forms;

namespace GroupScheduleUninstaller
{
    class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string installDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\');

            // 读取配置：卸载密码是否开启（默认开启）
            bool uninstallPwdEnabled = true;
            try
            {
                string configPath = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                    "class-service-manager", "data", "config.json");
                if (File.Exists(configPath))
                {
                    string json = File.ReadAllText(configPath).TrimStart('﻿');
                    var m = Regex.Match(json, @"""uninstallPasswordEnabled""\s*:\s*(true|false)");
                    if (m.Success) uninstallPwdEnabled = m.Groups[1].Value == "true";
                }
            }
            catch { }

            // 卸载前必须先通过密码校验（仅当卸载密码开启时）；取消或关闭窗口则直接退出
            if (uninstallPwdEnabled)
            {
                using (var pwdDialog = new PasswordDialog(installDir))
                {
                    if (pwdDialog.ShowDialog() != DialogResult.OK) return;
                }
            }

            string exePath = Path.Combine(installDir, "班级服务管理系统.exe");
            if (!File.Exists(exePath))
            {
                using (var msg = new ErrorDialog("找不到 班级服务管理系统.exe\n\n可能已被手动删除。"))
                    msg.ShowDialog();
                return;
            }

            using (var form = new UninstallForm(installDir))
                Application.Run(form);
        }
    }

    // ─────────────────────────────────────────────
    //  渐变圆角窗体基类
    // ─────────────────────────────────────────────
    abstract class GForm : Form
    {
        protected static readonly Color C1      = Color.FromArgb(15, 108, 189);
        protected static readonly Color C2      = Color.FromArgb(17, 94, 163);
        protected static readonly Color CText   = Color.FromArgb(27, 27, 27);
        protected static readonly Color CTextLt = Color.FromArgb(97, 97, 97);
        protected static readonly Color CPanel  = Color.FromArgb(245, 245, 245);
        protected static readonly Color CBorder = Color.FromArgb(224, 224, 224);
        protected static readonly Color CSoft   = Color.FromArgb(235, 243, 252);
        protected const int Radius = 8;

        protected Panel hero;
        protected PictureBox picIcon;
        protected Label lblTitle;
        protected Label lblSub;

        private bool isDragging = false;
        private Point dragStart;

        protected int DesignW;
        protected float dpiS = 1f;

        // 徽章距 Hero 顶部的设计坐标（各子类可覆盖）
        protected virtual int BadgeTop { get { return 16; } }

        protected void InitHero(int height, string title, string sub, int badgeSize)
        {
            DesignW = ClientSize.Width;
            hero = new Panel { Dock = DockStyle.Top, Height = height };
            hero.Paint += Hero_Paint;
            hero.MouseDown += Header_MouseDown;
            hero.MouseMove += Header_MouseMove;
            hero.MouseUp += Header_MouseUp;

            var badge = BadgeRect(badgeSize);
            picIcon = new PictureBox
            {
                BackColor = Color.Transparent,
                Location = new Point(badge.X + badgeSize / 6, badge.Y + badgeSize / 6),
                Size = new Size(badgeSize - badgeSize / 3, badgeSize - badgeSize / 3),
                SizeMode = PictureBoxSizeMode.StretchImage,
            };
            hero.Controls.Add(picIcon);

            lblTitle = new Label
            {
                Text = title,
                Font = new Font("Microsoft YaHei UI", 15F, FontStyle.Bold),
                ForeColor = CText,
                BackColor = Color.Transparent,
                TextAlign = ContentAlignment.MiddleCenter,
                Location = new Point(20, height - 58),
                Size = new Size(ClientSize.Width - 40, 28),
            };
            lblTitle.MouseDown += Header_MouseDown;
            lblTitle.MouseMove += Header_MouseMove;
            lblTitle.MouseUp += Header_MouseUp;
            hero.Controls.Add(lblTitle);

            if (sub != null)
            {
                lblSub = new Label
                {
                    Text = sub,
                    Font = new Font("Microsoft YaHei UI", 9F),
                    ForeColor = CTextLt,
                    BackColor = Color.Transparent,
                    TextAlign = ContentAlignment.MiddleCenter,
                    Location = new Point(20, height - 24),
                    Size = new Size(ClientSize.Width - 40, 20),
                };
                hero.Controls.Add(lblSub);
            }

            Controls.Add(hero);
        }

        protected void AddCloseButton()
        {
            var btn = new Button
            {
                Text = "×",
                Font = new Font("Microsoft YaHei UI", 13F),
                ForeColor = CTextLt,
                BackColor = Color.Transparent,
                FlatStyle = FlatStyle.Flat,
                Location = new Point(ClientSize.Width - 44, 8),
                Size = new Size(36, 32),
                Cursor = Cursors.Hand,
            };
            btn.FlatAppearance.BorderSize = 0;
            btn.FlatAppearance.MouseOverBackColor = Color.FromArgb(253, 231, 233);
            btn.FlatAppearance.MouseDownBackColor = Color.FromArgb(249, 211, 215);
            btn.MouseEnter += (s, e) => btn.ForeColor = Color.FromArgb(196, 43, 28);
            btn.MouseLeave += (s, e) => btn.ForeColor = CTextLt;
            btn.Click += (s, e) => { this.DialogResult = DialogResult.Cancel; this.Close(); };
            hero.Controls.Add(btn);
        }

        protected virtual Rectangle BadgeRect(int size)
        {
            return new Rectangle((ClientSize.Width - size) / 2, (int)(BadgeTop * dpiS), size, size);
        }

        protected override void OnLoad(EventArgs e)
        {
            base.OnLoad(e);
            // WinForms 按字体缩放完窗体后得到真实因子
            dpiS = ClientSize.Width / (float)DesignW;
        }

        protected virtual void Hero_Paint(object sender, PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            var rect = hero.ClientRectangle;
            // Fluent 浅色：白色背景 + 顶边淡蓝点缀 + 底部分隔线
            using (var br = new SolidBrush(Color.White))
                g.FillRectangle(br, rect);
            using (var br = new SolidBrush(CSoft))
                g.FillRectangle(br, 0, 0, rect.Width, 4);
            using (var pen = new Pen(CBorder, 1f))
                g.DrawLine(pen, 0, rect.Height - 1, rect.Width, rect.Height - 1);

            int badgeSize = picIcon.Width + picIcon.Width / 2;
            var badge = BadgeRect(badgeSize);
            using (var br = new SolidBrush(CSoft))
            using (var path = RoundedPath(badge, (int)(badgeSize * 0.27)))
                g.FillPath(br, path);
            using (var pen = new Pen(Color.FromArgb(215, 232, 250), 1.2f))
            using (var path = RoundedPath(badge, (int)(badgeSize * 0.27)))
                g.DrawPath(pen, path);
        }

        protected void ApplyRoundedRegion()
        {
            using (var path = RoundedPath(new Rectangle(0, 0, Width, Height), Radius))
                Region = new Region(path);
        }

        // 统一加载窗口图标与徽章图片。
        // 该 ico 全部为 PNG 压缩帧：用 Icon 类会得到乱码，
        // 必须读字节后走 GDI+ Image；Form.Icon 用 Shell API 提取。
        protected void LoadIcons(string dir, int px)
        {
            string[] candidates = {
                Path.Combine(dir, "app_icon.ico"),
                Path.Combine(dir, "resources", "app", "app_icon.ico"),
                Path.Combine(dir, "assets", "app_icon.ico"),
            };
            foreach (var p in candidates)
            {
                try
                {
                    if (!File.Exists(p)) continue;
                    this.Icon = Icon.ExtractAssociatedIcon(p);
                    byte[] bytes = File.ReadAllBytes(p);
                    using (var ms = new MemoryStream(bytes))
                    using (var img = Image.FromStream(ms))
                        picIcon.Image = new Bitmap(img, new Size(px, px));
                    return;
                }
                catch { }
            }
            // 兜底：安装目录中没有独立图标时，从自身嵌入资源 / exe 图标提取
            try
            {
                var asm = System.Reflection.Assembly.GetExecutingAssembly();
                using (var st = asm.GetManifestResourceStream("appicon"))
                {
                    if (st != null)
                    {
                        using (var img = Image.FromStream(st))
                            picIcon.Image = new Bitmap(img, new Size(px, px));
                        try { this.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
                        return;
                    }
                }
            }
            catch { }
            try
            {
                this.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
                if (this.Icon != null)
                    picIcon.Image = new Bitmap(this.Icon.ToBitmap(), new Size(px, px));
            }
            catch { }
        }

        internal static GraphicsPath RoundedPath(Rectangle r, int radius)
        {
            var path = new GraphicsPath();
            int d = radius * 2;
            path.AddArc(r.X, r.Y, d, d, 180, 90);
            path.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            path.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
            path.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            path.CloseFigure();
            return path;
        }

        private void Header_MouseDown(object sender, MouseEventArgs e)
        {
            if (e.Button == MouseButtons.Left)
            {
                isDragging = true;
                var screen = Cursor.Position;
                dragStart = new Point(screen.X - Left, screen.Y - Top);
            }
        }
        private void Header_MouseMove(object sender, MouseEventArgs e)
        {
            if (isDragging)
            {
                var screen = Cursor.Position;
                Location = new Point(screen.X - dragStart.X, screen.Y - dragStart.Y);
            }
        }
        private void Header_MouseUp(object sender, MouseEventArgs e) { isDragging = false; }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            using (var pen = new Pen(CBorder, 1))
            using (var path = RoundedPath(new Rectangle(0, 0, Width - 1, Height - 1), Radius))
                e.Graphics.DrawPath(pen, path);
        }
    }

    // ─────────────────────────────────────────────
    //  卸载密码验证窗
    // ─────────────────────────────────────────────
    class PasswordDialog : GForm
    {
        protected override int BadgeTop { get { return 12; } }

        private const string AdminPassword = "258000";
        private readonly string installDir;

        private GInput txtPassword;
        private Label lblError;
        private GButton btnCancel;
        private GButton btnConfirm;

        public PasswordDialog(string installDir)
        {
            this.installDir = installDir;
            Text = "卸载验证 - 班级服务管理系统";
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(420, 300);
            BackColor = Color.White;
            DoubleBuffered = true;
            Font = new Font("Microsoft YaHei UI", 9F);

            InitHero(120, "卸载验证", "请输入管理员密码或用户密码", 48);
            AddCloseButton();
            LoadAppIcon();
            InitBody();
            ApplyRoundedRegion();
        }

        private void LoadAppIcon()
        {
            LoadIcons(installDir, 72);
        }

        private void InitBody()
        {
            txtPassword = new GInput
            {
                Location = new Point(24, 142),
                Size = new Size(372, 38),
                IsPassword = true,
            };
            txtPassword.KeyEnter += (s, e) => Verify();
            Controls.Add(txtPassword);

            lblError = new Label
            {
                Text = "",
                Font = new Font("Microsoft YaHei UI", 8.5F),
                ForeColor = Color.FromArgb(220, 60, 60),
                TextAlign = ContentAlignment.MiddleCenter,
                Location = new Point(24, 186),
                Size = new Size(372, 18),
            };
            Controls.Add(lblError);

            btnCancel = new GButton
            {
                Text = "取消",
                Kind = GButton.BtnKind.Secondary,
                Location = new Point(210, 240),
                Size = new Size(90, 40),
            };
            btnCancel.Click += (s, e) => { DialogResult = DialogResult.Cancel; Close(); };
            Controls.Add(btnCancel);

            btnConfirm = new GButton
            {
                Text = "确认",
                Kind = GButton.BtnKind.Primary,
                Location = new Point(306, 240),
                Size = new Size(90, 40),
            };
            btnConfirm.Click += (s, e) => Verify();
            Controls.Add(btnConfirm);

            AcceptButton = btnConfirm;
            CancelButton = btnCancel;
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            txtPassword.FocusInput();
        }

        private void Verify()
        {
            string input = txtPassword.Text;
            if (string.IsNullOrEmpty(input))
            {
                lblError.Text = "请输入密码";
                txtPassword.FocusInput();
                return;
            }
            if (input == AdminPassword || input == LoadUserPassword())
            {
                DialogResult = DialogResult.OK;
                Close();
            }
            else
            {
                lblError.Text = "密码错误，请重新输入";
                txtPassword.Text = "";
                txtPassword.FocusInput();
            }
        }

        // 读取普通用户密码（config.json 的 password），失败回落默认 0912
        private string LoadUserPassword()
        {
            try
            {
                string configPath = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                    "class-service-manager", "data", "config.json");
                if (File.Exists(configPath))
                {
                    string json = File.ReadAllText(configPath).TrimStart('﻿');
                    var m = Regex.Match(json, @"""password""\s*:\s*""([^""]*)""");
                    if (m.Success) return m.Groups[1].Value;
                }
            }
            catch { }
            return "0912";
        }
    }

    // ─────────────────────────────────────────────
    //  卸载确认窗体
    // ─────────────────────────────────────────────
    class UninstallForm : GForm
    {
        protected override int BadgeTop { get { return 22; } }

        private readonly string installDir;

        private Panel pnlNotice;
        private Label lblNoticeTitle;
        private Label lblNoticePath;

        private GProgress progressBar;
        private Label lblProgress;

        private GButton btnCancel;
        private GButton btnConfirm;

        private Panel pnlDone;

        private bool isUninstalling = false;
        private bool completed = false;

        public UninstallForm(string installDir)
        {
            this.installDir = installDir;
            Text = "卸载 - 班级服务管理系统";
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(460, 420);
            BackColor = Color.White;
            DoubleBuffered = true;
            Font = new Font("Microsoft YaHei UI", 9F);

            InitHero(150, "确定要卸载吗？", "班级服务管理系统", 60);
            LoadAppIcon();
            InitBody();
            ApplyRoundedRegion();
        }

        private void LoadAppIcon()
        {
            LoadIcons(installDir, 72);
        }

        protected override Rectangle BadgeRect(int size)
        {
            return new Rectangle((ClientSize.Width - size) / 2, (int)(BadgeTop * dpiS), size, size);
        }

        private void InitBody()
        {
            // 数据保留提示
            pnlNotice = new Panel
            {
                BackColor = CPanel,
                Location = new Point(30, 168),
                Size = new Size(400, 74),
            };
            using (var path = RoundedPath(new Rectangle(0, 0, pnlNotice.Width, pnlNotice.Height), 8))
                pnlNotice.Region = new Region(path);

            var picShield = new Label
            {
                Text = "✓",
                Font = new Font("Microsoft YaHei UI", 14F, FontStyle.Bold),
                ForeColor = Color.FromArgb(14, 122, 13),
                Location = new Point(16, 12),
                Size = new Size(26, 26),
                BackColor = Color.Transparent,
            };
            pnlNotice.Controls.Add(picShield);

            lblNoticeTitle = new Label
            {
                Text = "您的表格数据将被保留",
                Font = new Font("Microsoft YaHei UI", 9.5F, FontStyle.Bold),
                ForeColor = CText,
                Location = new Point(48, 12),
                Size = new Size(320, 20),
                BackColor = Color.Transparent,
            };
            pnlNotice.Controls.Add(lblNoticeTitle);

            string dataPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "class-service-manager", "data");
            lblNoticePath = new Label
            {
                Text = dataPath,
                Font = new Font("Consolas", 8F),
                ForeColor = CTextLt,
                Location = new Point(48, 38),
                Size = new Size(336, 24),
                BackColor = Color.Transparent,
                AutoEllipsis = true,
            };
            pnlNotice.Controls.Add(lblNoticePath);
            Controls.Add(pnlNotice);

            // 进度
            progressBar = new GProgress
            {
                Location = new Point(30, 258),
                Size = new Size(400, 10),
                Visible = false,
            };
            Controls.Add(progressBar);

            lblProgress = new Label
            {
                Text = "",
                Font = new Font("Microsoft YaHei UI", 8.5F),
                ForeColor = CTextLt,
                TextAlign = ContentAlignment.MiddleCenter,
                Location = new Point(30, 274),
                Size = new Size(400, 18),
                Visible = false,
            };
            Controls.Add(lblProgress);

            // 按钮
            btnCancel = new GButton
            {
                Text = "取消",
                Kind = GButton.BtnKind.Secondary,
                Location = new Point(246, 356),
                Size = new Size(90, 40),
            };
            btnCancel.Click += (s, e) =>
            {
                if (isUninstalling) return;
                Close();
            };
            Controls.Add(btnCancel);

            btnConfirm = new GButton
            {
                Text = "确认卸载",
                Kind = GButton.BtnKind.Danger,
                Location = new Point(344, 356),
                Size = new Size(86, 40),
            };
            btnConfirm.Click += BtnConfirm_Click;
            Controls.Add(btnConfirm);
        }

        // 确认按钮统一入口：卸载中忽略；完成后仅关闭；否则开始卸载
        private void BtnConfirm_Click(object sender, EventArgs e)
        {
            if (isUninstalling) return;
            if (completed) { Close(); return; }
            StartUninstall();
        }

        private void StartUninstall()
        {
            isUninstalling = true;
            btnConfirm.Enabled = false;
            btnConfirm.Text = "卸载中";
            btnCancel.Enabled = false;

            lblTitle.Text = "正在卸载";
            lblSub.Text = "请稍候，请勿关闭窗口";
            pnlNotice.Visible = false;
            progressBar.Visible = true;
            lblProgress.Visible = true;
            progressBar.Value = 0;
            lblProgress.Text = "准备卸载...";

            var thread = new System.Threading.Thread(() =>
            {
                try { DoUninstall(); }
                catch (Exception ex)
                {
                    this.Invoke((Action)(() =>
                    {
                        MessageBox.Show(this, "卸载过程中出现错误:\n" + ex.Message,
                            "卸载错误", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    }));
                }
            });
            thread.IsBackground = true;
            thread.Start();
        }

        private void DoUninstall()
        {
            // ===== 多层安全校验，确保不会误删其他目录的文件 =====
            string exe1 = Path.Combine(installDir, "班级服务管理系统.exe");
            string exe2 = Path.Combine(installDir, "小组排名表管理系统.exe");
            string targetExe = File.Exists(exe1) ? exe1 : (File.Exists(exe2) ? exe2 : null);

            // 校验1：必须存在软件主程序 exe
            if (targetExe == null)
            {
                this.Invoke((Action)(() =>
                {
                    MessageBox.Show(this, "安全拦截：当前目录未找到软件主程序，已中止卸载。\n\n目录：" + installDir,
                        "安全拦截", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                }));
                return;
            }

            // 校验2：验证 exe 的版本信息确实是本软件（防止同名文件伪装）
            try
            {
                var vi = FileVersionInfo.GetVersionInfo(targetExe);
                string pn = (vi.ProductName ?? "").Trim();
                string fn = (vi.FileDescription ?? "").Trim();
                bool isOurApp = pn.Contains("班级服务管理系统") || pn.Contains("小组排名表")
                             || fn.Contains("班级服务管理系统") || fn.Contains("小组排名表")
                             || pn.Contains("class-service") || pn.Contains("group-schedule");
                if (!isOurApp)
                {
                    this.Invoke((Action)(() =>
                    {
                        MessageBox.Show(this, "安全拦截：主程序版本信息不匹配，疑似伪装文件，已中止卸载。\n\n目录：" + installDir,
                            "安全拦截", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    }));
                    return;
                }
            }
            catch
            {
                // 无法读取版本信息也视为不安全
                this.Invoke((Action)(() =>
                {
                    MessageBox.Show(this, "安全拦截：无法验证主程序身份，已中止卸载。\n\n目录：" + installDir,
                        "安全拦截", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                }));
                return;
            }

            // 校验3：必须存在 resources 目录（Electron 应用特征）
            string resDir = Path.Combine(installDir, "resources");
            if (!Directory.Exists(resDir))
            {
                this.Invoke((Action)(() =>
                {
                    MessageBox.Show(this, "安全拦截：当前目录缺少 resources 目录，不是本软件的安装目录，已中止卸载。\n\n目录：" + installDir,
                        "安全拦截", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                }));
                return;
            }

            // 校验4：禁止在系统关键目录执行（防止路径异常导致灾难）
            string lowerDir = installDir.ToLower();
            string sysRoot = Environment.GetFolderPath(Environment.SpecialFolder.Windows).ToLower();
            string sysDrive = Path.GetPathRoot(Environment.GetFolderPath(Environment.SpecialFolder.Windows)).ToLower().TrimEnd('\\');
            string[] forbidden = new[] {
                sysRoot,                                              // C:\Windows
                sysDrive,                                             // C:\
                Path.Combine(sysDrive, "program files").ToLower(),    // C:\Program Files
                Path.Combine(sysDrive, "program files (x86)").ToLower(),
                Path.Combine(sysDrive, "programdata").ToLower(),
                Path.Combine(sysDrive, "users").ToLower(),
                Environment.GetFolderPath(Environment.SpecialFolder.Desktop).ToLower(),
                Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments).ToLower(),
            };
            foreach (var f in forbidden)
            {
                if (lowerDir == f.TrimEnd('\\'))
                {
                    this.Invoke((Action)(() =>
                    {
                        MessageBox.Show(this, "安全拦截：禁止在系统关键目录执行卸载，已中止。\n\n目录：" + installDir,
                            "安全拦截", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    }));
                    return;
                }
            }

            // 校验5：目录内不得包含 Windows 系统文件（二次确认目录合法性）
            string[] sysFiles = { "explorer.exe", "kernel32.dll", "ntdll.dll", "winlogon.exe", "services.exe" };
            foreach (var sf in sysFiles)
            {
                if (File.Exists(Path.Combine(installDir, sf)))
                {
                    this.Invoke((Action)(() =>
                    {
                        MessageBox.Show(this, "安全拦截：当前目录包含系统文件 " + sf + "，疑似非软件安装目录，已中止卸载。\n\n目录：" + installDir,
                            "安全拦截", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    }));
                    return;
                }
            }

            // 1. 结束进程
            UpdateProgress(5, "正在关闭应用进程...");
            try
            {
                foreach (var p in Process.GetProcessesByName("班级服务管理系统"))
                {
                    try { p.Kill(); } catch { }
                }
                System.Threading.Thread.Sleep(800);
            }
            catch { }
            UpdateProgress(20, "进程已关闭");

            // 2. 删快捷方式
            UpdateProgress(25, "正在删除快捷方式...");
            string desktop = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
            foreach (var s in new[] {
                Path.Combine(desktop, "班级服务管理系统.lnk"),
                Path.Combine(desktop, "卸载班级服务管理系统.lnk") })
            {
                try { if (File.Exists(s)) File.Delete(s); } catch { }
            }
            UpdateProgress(35, "快捷方式已删除");

            // 3. 收集文件（保留 data 目录）
            var filesToDelete = new List<string>();
            var dirsToDelete = new List<string>();
            if (Directory.Exists(installDir))
            {
                foreach (var f in Directory.GetFiles(installDir))
                {
                    // 跳过卸载程序自身（运行中无法删除，退出后由批处理清理）
                    if (string.Equals(Path.GetFileName(f), "Uninstall.exe", StringComparison.OrdinalIgnoreCase)) continue;
                    filesToDelete.Add(f);
                }
                foreach (var d in Directory.GetDirectories(installDir))
                {
                    string name = Path.GetFileName(d);
                    if (name.Equals("data", StringComparison.OrdinalIgnoreCase)) continue;
                    dirsToDelete.Add(d);
                }
            }

            int total = filesToDelete.Count + dirsToDelete.Count;
            if (total == 0) total = 1;
            int deleted = 0, failed = 0, idx = 0;

            foreach (var f in filesToDelete)
            {
                idx++;
                UpdateProgress(35 + (int)((float)idx / total * 50),
                    string.Format("正在删除文件 ({0}/{1})...", idx, total));
                try { File.Delete(f); deleted++; } catch { failed++; }
            }
            foreach (var d in dirsToDelete)
            {
                idx++;
                UpdateProgress(35 + (int)((float)idx / total * 50),
                    string.Format("正在删除目录 ({0}/{1})...", idx, total));
                try { Directory.Delete(d, true); deleted++; } catch { failed++; }
            }
            UpdateProgress(90, "清理完成");

            // 4. 自删
            UpdateProgress(95, "正在清理卸载程序...");
            try
            {
                string batPath = Path.Combine(Path.GetTempPath(), "uninstall_cleanup_" +
                    Path.GetRandomFileName().Replace(".", "") + ".bat");
                // 安全机制：只删除卸载程序自身，不删除整个安装目录
                // （软件文件已在前面步骤逐个删除，这里仅清理卸载 exe 自身）
                string batContent = string.Format(
                    "@echo off\r\n" +
                    "timeout /t 2 /nobreak >nul\r\n" +
                    "del /f /q \"{0}\" 2>nul\r\n",
                    Process.GetCurrentProcess().MainModule.FileName);
                File.WriteAllText(batPath, batContent, System.Text.Encoding.Default);
                Process.Start(new ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = "/c \"" + batPath + "\"",
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    WindowStyle = ProcessWindowStyle.Hidden
                });
            }
            catch { }

            UpdateProgress(100, "卸载完成");

            this.Invoke((Action)(() =>
            {
                isUninstalling = false;
                ShowCompleteUI(deleted, failed);
            }));
        }

        private void UpdateProgress(int value, string text)
        {
            try
            {
                this.Invoke((Action)(() =>
                {
                    progressBar.Value = value;
                    lblProgress.Text = text;
                }));
            }
            catch { }
        }

        private void ShowCompleteUI(int deleted, int failed)
        {
            completed = true;
            progressBar.Visible = false;
            lblProgress.Visible = false;
            pnlNotice.Visible = false;

            lblTitle.Text = "卸载完成";
            lblSub.Text = "感谢您的使用";

            pnlDone = new Panel
            {
                BackColor = CPanel,
                Location = new Point(30, 168),
                Size = new Size(400, 140),
            };
            using (var path = RoundedPath(new Rectangle(0, 0, pnlDone.Width, pnlDone.Height), 8))
                pnlDone.Region = new Region(path);

            var lblStats = new Label
            {
                Text = failed > 0
                    ? string.Format("已删除 {0} 项，失败 {1} 项", deleted, failed)
                    : string.Format("已删除 {0} 项", deleted),
                Font = new Font("Microsoft YaHei UI", 10F, FontStyle.Bold),
                ForeColor = CText,
                Location = new Point(20, 18),
                Size = new Size(360, 24),
                BackColor = Color.Transparent,
            };
            pnlDone.Controls.Add(lblStats);

            var lblInfo = new Label
            {
                Text = "您的表格数据保留在：",
                Font = new Font("Microsoft YaHei UI", 8.5F),
                ForeColor = CText,
                Location = new Point(20, 48),
                Size = new Size(360, 18),
                BackColor = Color.Transparent,
            };
            pnlDone.Controls.Add(lblInfo);

            string dataPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "class-service-manager", "data");
            var lblDonePath = new Label
            {
                Text = dataPath,
                Font = new Font("Consolas", 8F),
                ForeColor = CTextLt,
                Location = new Point(20, 70),
                Size = new Size(360, 24),
                BackColor = Color.Transparent,
                AutoEllipsis = true,
            };
            pnlDone.Controls.Add(lblDonePath);
            Controls.Add(pnlDone);
            pnlDone.BringToFront();

            btnConfirm.Text = "完成";
            btnConfirm.Kind = GButton.BtnKind.Primary;
            btnConfirm.Enabled = true;
            btnCancel.Visible = false;
        }
    }

    // ─────────────────────────────────────────────
    //  自绘渐变按钮
    // ─────────────────────────────────────────────
    class GButton : Button
    {
        public enum BtnKind { Primary, Secondary, Success, Danger }

        private static readonly Color C1 = Color.FromArgb(15, 108, 189);
        private static readonly Color C2 = Color.FromArgb(17, 94, 163);
        private static readonly Color R1 = Color.FromArgb(196, 43, 28);
        private static readonly Color R2 = Color.FromArgb(164, 38, 22);

        private bool hover = false;
        private int radius = 6;
        public BtnKind Kind = BtnKind.Primary;

        public GButton()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint |
                     ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw |
                     ControlStyles.SupportsTransparentBackColor, true);
            FlatStyle = FlatStyle.Flat;
            Cursor = Cursors.Hand;
        }

        protected override void OnMouseEnter(EventArgs e) { hover = true; Invalidate(); base.OnMouseEnter(e); }
        protected override void OnMouseLeave(EventArgs e) { hover = false; Invalidate(); base.OnMouseLeave(e); }

        protected override void OnResize(EventArgs e)
        {
            base.OnResize(e);
            using (var path = GForm.RoundedPath(new Rectangle(0, 0, Width, Height), radius))
                Region = new Region(path);
        }

        protected override void OnPaint(PaintEventArgs pevent)
        {
            var g = pevent.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            var rect = new Rectangle(0, 0, Width - 1, Height - 1);

            if (!Enabled)
            {
                using (var br = new SolidBrush(Color.FromArgb(240, 240, 240)))
                using (var path = GForm.RoundedPath(rect, radius))
                    g.FillPath(br, path);
                using (var pen = new Pen(Color.FromArgb(224, 224, 224), 1))
                using (var path = GForm.RoundedPath(rect, radius))
                    g.DrawPath(pen, path);
                TextRenderer.DrawText(g, Text, Font, ClientRectangle, Color.FromArgb(166, 166, 166),
                    TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
                return;
            }

            if (Kind == BtnKind.Secondary)
            {
                using (var br = new SolidBrush(hover ? Color.FromArgb(245, 245, 245) : Color.White))
                using (var path = GForm.RoundedPath(rect, radius))
                    g.FillPath(br, path);
                using (var pen = new Pen(Color.FromArgb(209, 209, 209), 1))
                using (var path = GForm.RoundedPath(rect, radius))
                    g.DrawPath(pen, path);
                TextRenderer.DrawText(g, Text, Font, ClientRectangle, Color.FromArgb(27, 27, 27),
                    TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
                return;
            }

            Color a, b;
            if (Kind == BtnKind.Danger) { a = R1; b = R2; }
            else { a = C1; b = C2; }

            using (var br = new SolidBrush(a))
            using (var path = GForm.RoundedPath(rect, radius))
                g.FillPath(br, path);
            if (hover)
            {
                using (var br = new SolidBrush(b))
                using (var path = GForm.RoundedPath(rect, radius))
                    g.FillPath(br, path);
            }
            TextRenderer.DrawText(g, Text, new Font(Font, FontStyle.Bold), ClientRectangle, Color.White,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        }
    }

    // ─────────────────────────────────────────────
    //  圆角输入框
    // ─────────────────────────────────────────────
    class GInput : Panel
    {
        private TextBox tb;
        private bool focused = false;
        private int radius = 6;

        public bool IsPassword = false;
        public event EventHandler KeyEnter;

        public GInput()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint |
                     ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            BackColor = Color.White;

            tb = new TextBox
            {
                BorderStyle = BorderStyle.None,
                Font = new Font("Microsoft YaHei UI", 11F),
                BackColor = Color.White,
                ForeColor = Color.FromArgb(27, 27, 27),
                Location = new Point(12, 9),
                Width = 348,
            };
            tb.GotFocus += (s, e) => { focused = true; Invalidate(); };
            tb.LostFocus += (s, e) => { focused = false; Invalidate(); };
            tb.KeyDown += (s, e) =>
            {
                if (e.KeyCode == Keys.Enter)
                {
                    e.SuppressKeyPress = true;
                    if (KeyEnter != null) KeyEnter(this, EventArgs.Empty);
                }
            };
            Controls.Add(tb);
        }

        public string Text
        {
            get { return tb.Text; }
            set { tb.Text = value; }
        }

        public void FocusInput() { tb.Focus(); }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            if (IsPassword)
            {
                tb.UseSystemPasswordChar = true;
                tb.MaxLength = 8;
            }
        }

        protected override void OnResize(EventArgs e)
        {
            base.OnResize(e);
            tb.Width = Width - 24;
            using (var path = GForm.RoundedPath(new Rectangle(0, 0, Width, Height), radius))
                Region = new Region(path);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            using (var br = new SolidBrush(BackColor))
            using (var path = GForm.RoundedPath(new Rectangle(0, 0, Width - 1, Height - 1), radius))
                g.FillPath(br, path);
            using (var pen = new Pen(focused ? Color.FromArgb(15, 108, 189) : Color.FromArgb(209, 209, 209), focused ? 2f : 1f))
            using (var path = GForm.RoundedPath(new Rectangle(0, 0, Width - 1, Height - 1), radius))
                g.DrawPath(pen, path);
        }
    }

    // ─────────────────────────────────────────────
    //  自绘进度条
    // ─────────────────────────────────────────────
    class GProgress : Control
    {
        private int val = 0;
        private int radius = 3;
        private static readonly Color C1 = Color.FromArgb(15, 108, 189);

        public GProgress()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint |
                     ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        }

        public int Value
        {
            get { return val; }
            set { val = Math.Max(0, Math.Min(100, value)); Invalidate(); }
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            var rect = new Rectangle(0, 0, Width - 1, Height - 1);

            using (var br = new SolidBrush(Color.FromArgb(224, 224, 224)))
            using (var path = GForm.RoundedPath(rect, radius))
                g.FillPath(br, path);

            if (val > 0)
            {
                int fw = (int)((float)val / 100 * Width);
                if (fw < radius * 2) fw = radius * 2;
                var fill = new Rectangle(0, 0, fw, Height - 1);
                using (var br = new SolidBrush(C1))
                using (var path = GForm.RoundedPath(fill, radius))
                    g.FillPath(br, path);
            }
        }
    }

    // ─────────────────────────────────────────────
    //  错误提示窗
    // ─────────────────────────────────────────────
    class ErrorDialog : Form
    {
        public ErrorDialog(string message)
        {
            Text = "提示";
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(400, 210);
            BackColor = Color.White;
            DoubleBuffered = true;
            Font = new Font("Microsoft YaHei UI", 9F);

            using (var path = GForm.RoundedPath(new Rectangle(0, 0, Width, Height), 8))
                Region = new Region(path);

            var top = new Panel { Dock = DockStyle.Top, Height = 64 };
            top.Paint += (s, e) =>
            {
                using (var br = new SolidBrush(Color.FromArgb(253, 231, 233)))
                    e.Graphics.FillRectangle(br, top.ClientRectangle);
                using (var pen = new Pen(Color.FromArgb(249, 211, 215)))
                    e.Graphics.DrawLine(pen, 0, top.Height - 1, top.Width, top.Height - 1);
            };
            var lblT = new Label
            {
                Text = "提示",
                Font = new Font("Microsoft YaHei UI", 13F, FontStyle.Bold),
                ForeColor = Color.FromArgb(196, 43, 28),
                Location = new Point(20, 18),
                Size = new Size(200, 26),
                BackColor = Color.Transparent,
            };
            top.Controls.Add(lblT);
            Controls.Add(top);

            var lblMsg = new Label
            {
                Text = message,
                Font = new Font("Microsoft YaHei UI", 9.5F),
                ForeColor = Color.FromArgb(27, 27, 27),
                Location = new Point(20, 88),
                Size = new Size(360, 60),
            };
            Controls.Add(lblMsg);

            var btnOK = new GButton
            {
                Text = "确定",
                Location = new Point(290, 156),
                Size = new Size(90, 38),
            };
            btnOK.Click += (s, e) => { DialogResult = DialogResult.OK; Close(); };
            Controls.Add(btnOK);
            AcceptButton = btnOK;
        }
    }
}
