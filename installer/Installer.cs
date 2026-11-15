using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

namespace GroupScheduleInstaller
{
    class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            try
            {
                using (var form = new InstallerForm())
                    Application.Run(form);
            }
            catch (Exception ex)
            {
                MessageBox.Show("安装程序出现错误:\n\n" + ex.Message + "\n\n" + ex.StackTrace,
                    "安装错误", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }

    // ─────────────────────────────────────────────
    //  安装主窗体
    // ─────────────────────────────────────────────
    class InstallerForm : Form
    {
        // 主题（Fluent / Win11 浅色）
        private static readonly Color C1       = Color.FromArgb(15, 108, 189);   // 主色
        private static readonly Color C2       = Color.FromArgb(17, 94, 163);    // 主色悬停
        private static readonly Color Green1   = Color.FromArgb(14, 122, 13);
        private static readonly Color Green2   = Color.FromArgb(12, 95, 12);
        private static readonly Color CText    = Color.FromArgb(27, 27, 27);
        private static readonly Color CTextLt  = Color.FromArgb(97, 97, 97);
        private static readonly Color CPanel   = Color.FromArgb(245, 245, 245);
        private static readonly Color CBorder  = Color.FromArgb(224, 224, 224);
        private static readonly Color CSoft    = Color.FromArgb(235, 243, 252);
        private static readonly Color CText3   = Color.FromArgb(138, 138, 138);

        // Hero
        private Panel pnlHero;
        private PictureBox picIcon;
        private Label lblHeroTitle;
        private Label lblHeroSub;
        private Button btnClose;

        // 路径
        private Label lblPathTitle;
        private GInput txtPath;
        private GButton btnBrowse;

        // 选项
        private CheckBox chkDesktopShortcut;

        // 进度
        private GProgress progressBar;
        private Label lblProgress;
        private Label lblProgressDetail;

        // 完成
        private Panel pnlDone;
        private Panel pnlFeatures;

        // 按钮
        private GButton btnCancel;
        private GButton btnInstall;

        // 协议
        private Panel pnlLicense;
        private TextBox txtLicense;
        private Label lblLicenseTitle;
        private GButton btnAgree;
        private GButton btnDisagree;

        // 状态
        private bool isInstalling = false;
        private string phase = "license";   // license | welcome | installing | done
        private float dpiS = 1f;            // 实际 DPI 缩放因子（OnLoad 后可知）

        // 拖动
        private bool isDragging = false;
        private Point dragStart;

        // 嵌入数据标记
        private const string MARKER = "APPINSTALL_END_V1";

        private const string LICENSE_TEXT = @"欢迎使用""班级服务管理系统""软件（以下简称""本软件""）。

在使用本软件前，请您仔细阅读以下条款：

1. 本软件为免费软件，仅供个人学习、班级管理使用。
2. 您承诺不将本软件用于任何非法或违反道德的活动。
3. 本软件作者不对因使用本软件产生的任何数据丢失或损坏负责。
4. 您的使用数据（如值日名单、作业记录）仅保存在本地，不会上传至任何服务器。
5. 软件更新时会自动检查新版本，有新版本时您可自主选择更新。

如您同意以上条款，请点击""同意""继续使用；否则请点击""不同意""退出。

（本协议最终解释权归作者所有）";

        // 默认安装路径
        private string defaultPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Programs", "班级服务管理系统");

        private const int Radius = 8;

        public InstallerForm()
        {
            this.Text = "班级服务管理系统 - 安装程序";
            this.FormBorderStyle = FormBorderStyle.None;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.ClientSize = new Size(560, 540);
            this.BackColor = Color.White;
            this.DoubleBuffered = true;
            this.Font = new Font("Microsoft YaHei UI", 9F);

            LoadAppIcon();
            InitUI();
            ApplyRoundedRegion();

            txtPath.Text = defaultPath;

            ShowLicensePage();
        }

        private void ShowLicensePage()
        {
            phase = "license";
            lblHeroTitle.Text = "班级服务管理系统";
            lblHeroSub.Text = "用户协议";
            picIcon.Visible = true;

            // 隐藏 welcome 控件
            lblPathTitle.Visible = false;
            txtPath.Visible = false;
            btnBrowse.Visible = false;
            chkDesktopShortcut.Visible = false;
            pnlFeatures.Visible = false;

            // 创建协议面板
            pnlLicense = new Panel
            {
                Location = new Point(32, 204),
                Size = new Size(496, 240),
                BackColor = Color.White,
            };

            lblLicenseTitle = new Label
            {
                Text = "请仔细阅读以下用户协议",
                Font = new Font("Microsoft YaHei UI", 10F, FontStyle.Bold),
                ForeColor = CText,
                Location = new Point(0, 0),
                Size = new Size(496, 24),
                BackColor = Color.Transparent,
            };
            pnlLicense.Controls.Add(lblLicenseTitle);

            txtLicense = new TextBox
            {
                Text = LICENSE_TEXT,
                Font = new Font("Microsoft YaHei UI", 9F),
                ForeColor = Color.FromArgb(80, 80, 80),
                Location = new Point(0, 30),
                Size = new Size(496, 210),
                Multiline = true,
                ReadOnly = true,
                ScrollBars = ScrollBars.Vertical,
                BorderStyle = BorderStyle.FixedSingle,
                BackColor = Color.FromArgb(250, 250, 250),
            };
            pnlLicense.Controls.Add(txtLicense);
            this.Controls.Add(pnlLicense);
            pnlLicense.BringToFront();

            // 底部按钮改为 同意 / 不同意
            btnCancel.Text = "不同意";
            btnCancel.Click -= BtnCancel_Click_Welcome;
            btnCancel.Click -= BtnCancel_Click_License;
            btnCancel.Click += BtnCancel_Click_License;
            btnInstall.Text = "同意";
            btnInstall.Click -= BtnInstall_Click;
            btnInstall.Click += BtnAgree_Click;
        }

        private void BtnAgree_Click(object sender, EventArgs e)
        {
            // 切换到 welcome
            if (pnlLicense != null) { pnlLicense.Visible = false; }
            lblPathTitle.Visible = true;
            txtPath.Visible = true;
            btnBrowse.Visible = true;
            chkDesktopShortcut.Visible = true;
            pnlFeatures.Visible = true;

            lblHeroSub.Text = "版本 3.5.2  ·  请选择安装位置";
            phase = "welcome";

            btnCancel.Text = "取消";
            btnCancel.Click -= BtnCancel_Click_License;
            btnCancel.Click += BtnCancel_Click_Welcome;
            btnInstall.Text = "开始安装";
            btnInstall.Click -= BtnAgree_Click;
            btnInstall.Click += BtnInstall_Click;
            UpdateInstallButton();
        }

        private void BtnCancel_Click_License(object sender, EventArgs e)
        {
            this.Close();
        }

        private void BtnCancel_Click_Welcome(object sender, EventArgs e)
        {
            if (isInstalling)
            {
                var r = MessageBox.Show(this, "安装正在进行中，确定要取消吗？",
                    "确认取消", MessageBoxButtons.YesNo, MessageBoxIcon.Warning);
                if (r != DialogResult.Yes) return;
            }
            this.Close();
        }

        private void LoadAppIcon()
        {
            try
            {
                string selfPath = Application.ExecutablePath;
                if (selfPath != null && File.Exists(selfPath))
                    this.Icon = Icon.ExtractAssociatedIcon(selfPath);
            }
            catch { }
        }

        // 从托管资源加载图标（PNG 帧 ico 用 Icon 类会得到乱码，必须走 GDI+ Image）
        private void LoadBadgeImage()
        {
            try
            {
                var asm = System.Reflection.Assembly.GetExecutingAssembly();
                using (var rs = asm.GetManifestResourceStream("appicon"))
                {
                    if (rs != null)
                    {
                        // 先读入内存，避免 GDI+ 持有程序集流
                        using (var img = Image.FromStream(rs))
                            picIcon.Image = new Bitmap(img, new Size(72, 72));
                    }
                }
            }
            catch { }
        }

        private void InitUI()
        {
            // ── Hero 渐变区 ──
            pnlHero = new Panel
            {
                Dock = DockStyle.Top,
                Height = 180,
            };
            pnlHero.Paint += Hero_Paint;
            pnlHero.MouseDown += Header_MouseDown;
            pnlHero.MouseMove += Header_MouseMove;
            pnlHero.MouseUp += Header_MouseUp;

            picIcon = new PictureBox
            {
                BackColor = Color.Transparent,
                Location = new Point(262, 42),
                Size = new Size(36, 36),
                SizeMode = PictureBoxSizeMode.StretchImage,
            };
            try
            {
                LoadBadgeImage();
            }
            catch { }
            pnlHero.Controls.Add(picIcon);

            lblHeroTitle = new Label
            {
                Text = "班级服务管理系统",
                Font = new Font("Microsoft YaHei UI", 17F, FontStyle.Bold),
                ForeColor = CText,
                BackColor = Color.Transparent,
                TextAlign = ContentAlignment.MiddleCenter,
                Location = new Point(30, 102),
                Size = new Size(500, 34),
            };
            lblHeroTitle.MouseDown += Header_MouseDown;
            lblHeroTitle.MouseMove += Header_MouseMove;
            lblHeroTitle.MouseUp += Header_MouseUp;
            pnlHero.Controls.Add(lblHeroTitle);

            lblHeroSub = new Label
            {
                Text = "版本 3.5.2  ·  请选择安装位置",
                Font = new Font("Microsoft YaHei UI", 9.5F),
                ForeColor = CTextLt,
                BackColor = Color.Transparent,
                TextAlign = ContentAlignment.MiddleCenter,
                Location = new Point(30, 138),
                Size = new Size(500, 22),
            };
            pnlHero.Controls.Add(lblHeroSub);

            btnClose = new Button
            {
                Text = "×",
                Font = new Font("Microsoft YaHei UI", 13F),
                ForeColor = CTextLt,
                BackColor = Color.Transparent,
                FlatStyle = FlatStyle.Flat,
                Location = new Point(516, 8),
                Size = new Size(36, 32),
                Cursor = Cursors.Hand,
            };
            btnClose.FlatAppearance.BorderSize = 0;
            btnClose.FlatAppearance.MouseOverBackColor = Color.FromArgb(253, 231, 233);
            btnClose.FlatAppearance.MouseDownBackColor = Color.FromArgb(249, 211, 215);
            btnClose.MouseEnter += (s, e) => btnClose.ForeColor = Color.FromArgb(196, 43, 28);
            btnClose.MouseLeave += (s, e) => btnClose.ForeColor = CTextLt;
            btnClose.Click += (s, e) =>
            {
                if (isInstalling)
                {
                    var r = MessageBox.Show(this, "安装正在进行中，确定要退出吗？\n\n退出后文件可能不完整。",
                        "确认退出", MessageBoxButtons.YesNo, MessageBoxIcon.Warning);
                    if (r != DialogResult.Yes) return;
                }
                this.Close();
            };
            pnlHero.Controls.Add(btnClose);
            this.Controls.Add(pnlHero);

            // ── 路径 ──
            lblPathTitle = new Label
            {
                Text = "安装位置",
                Font = new Font("Microsoft YaHei UI", 9.5F, FontStyle.Bold),
                ForeColor = CText,
                Location = new Point(32, 204),
                Size = new Size(120, 20),
            };
            this.Controls.Add(lblPathTitle);

            txtPath = new GInput
            {
                Location = new Point(32, 230),
                Size = new Size(430, 38),
            };
            txtPath.InnerTextChanged += (s, e) => UpdateInstallButton();
            this.Controls.Add(txtPath);

            btnBrowse = new GButton
            {
                Text = "浏览",
                Kind = GButton.BtnKind.Secondary,
                Location = new Point(470, 230),
                Size = new Size(58, 38),
            };
            btnBrowse.Click += (s, e) =>
            {
                using (var dlg = new FolderBrowserDialog())
                {
                    dlg.Description = "请选择安装目录";
                    dlg.ShowNewFolderButton = true;
                    if (Directory.Exists(txtPath.Text))
                        dlg.SelectedPath = txtPath.Text;
                    if (dlg.ShowDialog(this) == DialogResult.OK)
                        txtPath.Text = dlg.SelectedPath;
                }
            };
            this.Controls.Add(btnBrowse);

            // ── 选项 ──
            chkDesktopShortcut = new CheckBox
            {
                Text = "创建桌面快捷方式",
                Font = new Font("Microsoft YaHei UI", 9.5F),
                ForeColor = CText,
                Checked = true,
                AutoSize = false,
                Location = new Point(32, 282),
                Size = new Size(240, 26),
                FlatStyle = FlatStyle.Flat,
            };
            chkDesktopShortcut.FlatAppearance.BorderColor = Color.FromArgb(201, 207, 219);
            this.Controls.Add(chkDesktopShortcut);

            // ── 特性速览（填充留白，安装开始时隐藏）──
            pnlFeatures = new Panel
            {
                Location = new Point(32, 328),
                Size = new Size(496, 120),
                BackColor = Color.Transparent,
            };
            var feats = new[] {
                new Tuple<string,string>("智能排名与座位表，一键自动安排", "#0F6CBD"),
                new Tuple<string,string>("成绩导入导出 Excel，打印方便", "#0E7A0D"),
                new Tuple<string,string>("多款皮肤主题，数据本地保存", "#C46B00"),
            };
            for (int i = 0; i < feats.Length; i++)
            {
                int y = 6 + i * 36;
                var dot = new Label
                {
                    Text = "●",
                    Font = new Font("Microsoft YaHei UI", 10F),
                    ForeColor = ColorTranslator.FromHtml(feats[i].Item2),
                    Location = new Point(2, y),
                    Size = new Size(20, 24),
                    BackColor = Color.Transparent,
                };
                pnlFeatures.Controls.Add(dot);
                var txt = new Label
                {
                    Text = feats[i].Item1,
                    Font = new Font("Microsoft YaHei UI", 9.5F),
                    ForeColor = CTextLt,
                    Location = new Point(28, y + 1),
                    Size = new Size(460, 24),
                    BackColor = Color.Transparent,
                };
                pnlFeatures.Controls.Add(txt);
            }
            this.Controls.Add(pnlFeatures);

            // ── 进度（默认隐藏）──
            progressBar = new GProgress
            {
                Location = new Point(32, 330),
                Size = new Size(496, 10),
                Visible = false,
            };
            this.Controls.Add(progressBar);

            lblProgress = new Label
            {
                Text = "",
                Font = new Font("Microsoft YaHei UI", 10F, FontStyle.Bold),
                ForeColor = CText,
                TextAlign = ContentAlignment.MiddleCenter,
                Location = new Point(32, 350),
                Size = new Size(496, 22),
                Visible = false,
            };
            this.Controls.Add(lblProgress);

            lblProgressDetail = new Label
            {
                Text = "",
                Font = new Font("Microsoft YaHei UI", 8.5F),
                ForeColor = CTextLt,
                TextAlign = ContentAlignment.MiddleCenter,
                Location = new Point(32, 376),
                Size = new Size(496, 20),
                Visible = false,
            };
            this.Controls.Add(lblProgressDetail);

            // ── 底部按钮 ──
            btnCancel = new GButton
            {
                Text = "取消",
                Kind = GButton.BtnKind.Secondary,
                Location = new Point(352, 482),
                Size = new Size(88, 40),
            };
            // btnCancel 的点击事件由 ShowLicensePage / BtnAgree_Click 动态绑定
            this.Controls.Add(btnCancel);

            btnInstall = new GButton
            {
                Text = "开始安装",
                Kind = GButton.BtnKind.Primary,
                Location = new Point(448, 482),
                Size = new Size(80, 40),
            };
            btnInstall.Click += BtnInstall_Click;
            this.Controls.Add(btnInstall);

            this.CancelButton = btnCancel;
            UpdateInstallButton();
        }

        // Hero 自绘：渐变背景 + 图标徽章 / 成功徽章
        private void Hero_Paint(object sender, PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            var rect = pnlHero.ClientRectangle;
            // Fluent 浅色：白色背景 + 顶边淡蓝点缀 + 底部分隔线
            using (var br = new SolidBrush(Color.White))
                g.FillRectangle(br, rect);
            using (var br = new SolidBrush(CSoft))
                g.FillRectangle(br, 0, 0, rect.Width, 4);
            using (var pen = new Pen(CBorder, 1f))
                g.DrawLine(pen, 0, rect.Height - 1, rect.Width, rect.Height - 1);

            // 徽章（尺寸与位置按实际 DPI 因子换算，保证始终居中于渐变区）
            int bs = (int)(60 * dpiS);
            int brr = (int)(bs * 0.27);
            var badge = new Rectangle((pnlHero.Width - bs) / 2, (int)(30 * dpiS), bs, bs);
            if (phase == "done")
            {
                using (var br = new LinearGradientBrush(badge, Green1, Green2, LinearGradientMode.Vertical))
                using (var path = RoundedPath(badge, brr))
                    g.FillPath(br, path);
                using (var pen = new Pen(Color.White, 4 * dpiS))
                {
                    pen.StartCap = LineCap.Round;
                    pen.EndCap = LineCap.Round;
                    float f = dpiS;
                    g.DrawLine(pen, badge.X + 18*f, badge.Y + 32*f, badge.X + 27*f, badge.Y + 41*f);
                    g.DrawLine(pen, badge.X + 27*f, badge.Y + 41*f, badge.X + 44*f, badge.Y + 20*f);
                }
            }
            else
            {
                using (var br = new SolidBrush(CSoft))
                using (var path = RoundedPath(badge, brr))
                    g.FillPath(br, path);
                using (var pen = new Pen(Color.FromArgb(215, 232, 250), 1.2f * dpiS))
                using (var path = RoundedPath(badge, brr))
                    g.DrawPath(pen, path);
            }
        }

        // 主按钮统一入口：未完成时开始安装，完成态仅关闭窗口
        private void BtnInstall_Click(object sender, EventArgs e)
        {
            if (phase == "done") { this.Close(); return; }
            if (!isInstalling) StartInstall();
        }

        protected override void OnLoad(EventArgs e)
        {
            base.OnLoad(e);
            // WinForms 按字体缩放完窗体后，由此因子换算自绘元素
            dpiS = ClientSize.Width / 560f;
        }

        private void UpdateInstallButton()
        {
            btnInstall.Enabled = !string.IsNullOrWhiteSpace(txtPath.Text) && !isInstalling;
        }

        private void ApplyRoundedRegion()
        {
            using (var path = RoundedPath(new Rectangle(0, 0, this.Width, this.Height), Radius))
                this.Region = new Region(path);
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

        // ── 拖动 ──
        private void Header_MouseDown(object sender, MouseEventArgs e)
        {
            if (e.Button == MouseButtons.Left)
            {
                isDragging = true;
                var screen = Cursor.Position;
                dragStart = new Point(screen.X - this.Left, screen.Y - this.Top);
            }
        }
        private void Header_MouseMove(object sender, MouseEventArgs e)
        {
            if (isDragging)
            {
                var screen = Cursor.Position;
                this.Location = new Point(screen.X - dragStart.X, screen.Y - dragStart.Y);
            }
        }
        private void Header_MouseUp(object sender, MouseEventArgs e)
        {
            isDragging = false;
        }

        // 外边框
        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            using (var pen = new Pen(CBorder, 1))
            using (var path = RoundedPath(new Rectangle(0, 0, this.Width - 1, this.Height - 1), Radius))
                e.Graphics.DrawPath(pen, path);
        }

        // ── 开始安装 ──
        private void StartInstall()
        {
            string installPath = txtPath.Text.Trim();

            string lastSeg = Path.GetFileName(installPath.TrimEnd('\\', '/'));
            if (!string.Equals(lastSeg, "班级服务管理系统", StringComparison.OrdinalIgnoreCase))
                installPath = Path.Combine(installPath, "班级服务管理系统");

            string[] dangerous = {
                Environment.GetFolderPath(Environment.SpecialFolder.Desktop),
                Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                Environment.GetFolderPath(Environment.SpecialFolder.Windows),
                Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                "C:\\",
            };
            foreach (var d in dangerous)
            {
                if (!string.IsNullOrEmpty(d) &&
                    string.Equals(installPath.TrimEnd('\\'), d.TrimEnd('\\'), StringComparison.OrdinalIgnoreCase))
                {
                    MessageBox.Show(this, "不能安装到系统关键目录，请选择其他路径：\n\n" + d,
                        "安装位置错误", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    return;
                }
            }

            txtPath.Text = installPath;

            isInstalling = true;
            phase = "installing";
            btnInstall.Enabled = false;
            btnInstall.Text = "安装中";
            btnCancel.Enabled = false;
            txtPath.SetEnabled(false);
            btnBrowse.Enabled = false;
            chkDesktopShortcut.Enabled = false;

            lblHeroTitle.Text = "正在安装";
            lblHeroSub.Text = "请稍候，请勿关闭窗口";
            picIcon.Visible = false;
            pnlHero.Invalidate();

            lblPathTitle.Visible = false;
            txtPath.Visible = false;
            btnBrowse.Visible = false;
            chkDesktopShortcut.Visible = false;
            pnlFeatures.Visible = false;

            progressBar.Visible = true;
            lblProgress.Visible = true;
            lblProgressDetail.Visible = true;
            progressBar.Value = 0;
            lblProgress.Text = "准备安装...";
            lblProgressDetail.Text = "";

            var thread = new System.Threading.Thread(() =>
            {
                try { DoInstall(installPath); }
                catch (Exception ex)
                {
                    this.Invoke((Action)(() =>
                    {
                        MessageBox.Show(this, "安装失败:\n\n" + ex.Message,
                            "安装错误", MessageBoxButtons.OK, MessageBoxIcon.Error);
                        ResetUIAfterFailure();
                    }));
                }
            });
            thread.IsBackground = true;
            thread.Start();
        }

        private void DoInstall(string installPath)
        {
            // 0. 结束运行中的应用
            UpdateProgressUI(1, "正在关闭运行中的程序...", "");
            try
            {
                foreach (var p in Process.GetProcessesByName("班级服务管理系统"))
                {
                    try { p.Kill(); } catch { }
                }
                // Wait up to 8 seconds for all processes to exit
                for (int w = 0; w < 16; w++)
                {
                    var still = Process.GetProcessesByName("班级服务管理系统");
                    if (still.Length == 0) break;
                    System.Threading.Thread.Sleep(500);
                }
            }
            catch { }

            // 1. 读取嵌入数据
            UpdateProgressUI(2, "正在读取安装数据...", "");
            EmbeddedData data = ReadEmbeddedData();
            if (data == null) throw new Exception("无法读取嵌入的安装数据。");

            // 2. 创建目录
            UpdateProgressUI(5, "正在创建安装目录...", installPath);
            Directory.CreateDirectory(installPath);

            // 3. 解压
            UpdateProgressUI(10, "正在解压应用文件...", "");
            int totalEntries;
            using (var ms = new MemoryStream(data.ZipBytes))
            using (var archive = new ZipArchive(ms, ZipArchiveMode.Read))
            {
                totalEntries = archive.Entries.Count;
                int done = 0;
                foreach (var entry in archive.Entries)
                {
                    done++;
                    string relativePath = entry.FullName.Replace('/', Path.DirectorySeparatorChar);
                    string targetPath = Path.Combine(installPath, relativePath);

                    // 防路径穿越
                    string fullTarget = Path.GetFullPath(targetPath);
                    string fullInstall = Path.GetFullPath(installPath);
                    if (!fullTarget.StartsWith(fullInstall, StringComparison.OrdinalIgnoreCase))
                        continue;

                    if (relativePath.EndsWith(Path.DirectorySeparatorChar.ToString()) ||
                        string.IsNullOrEmpty(entry.Name))
                    {
                        Directory.CreateDirectory(targetPath);
                    }
                    else
                    {
                        string dir = Path.GetDirectoryName(targetPath);
                        if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
                        bool written = false;
                        for (int retry = 0; retry < 5 && !written; retry++)
                        {
                            try
                            {
                                using (var src = entry.Open())
                                using (var dst = new FileStream(targetPath, FileMode.Create, FileAccess.Write, FileShare.None))
                                    src.CopyTo(dst);
                                written = true;
                            }
                            catch
                            {
                                if (retry < 4) System.Threading.Thread.Sleep(600);
                            }
                        }
                        if (!written)
                        {
                            string critical = Path.GetFileName(targetPath).ToLower();
                            if (critical == "app.asar" || critical.EndsWith(".exe"))
                                throw new Exception("File is in use and cannot be overwritten: " + relativePath + ". Please close the app and retry.");
                        }
                    }

                    int pct = 10 + (int)((float)done / totalEntries * 70);
                    UpdateProgressUI(pct, "正在解压应用文件...",
                        string.Format("({0}/{1})  {2}", done, totalEntries, entry.Name));
                }
            }

            // 4. Uninstall.exe
            UpdateProgressUI(82, "正在安装卸载程序...", "Uninstall.exe");
            string uninstallPath = Path.Combine(installPath, "Uninstall.exe");
            File.WriteAllBytes(uninstallPath, data.UninstallBytes);

            // 4.5 清理旧版解压目录（旧版为 resources\app，新版统一使用 resources\app.asar）
            try
            {
                string oldAppDir = Path.Combine(installPath, "resources", "app");
                if (Directory.Exists(oldAppDir)) Directory.Delete(oldAppDir, true);
            }
            catch { }

            // 5. 快捷方式
            UpdateProgressUI(90, "正在创建快捷方式...", "");
            string desktop = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
            string appExePath = Path.Combine(installPath, "班级服务管理系统.exe");

            string iconPath = Path.Combine(installPath, "app_icon.ico");
            if (chkDesktopShortcut.Checked)
                CreateShortcut(Path.Combine(desktop, "班级服务管理系统.lnk"),
                    appExePath, installPath, "班级服务管理系统", iconPath);

            CreateShortcut(Path.Combine(desktop, "卸载班级服务管理系统.lnk"),
                uninstallPath, installPath, "卸载班级服务管理系统", iconPath);

            UpdateProgressUI(100, "安装完成！", "");
            System.Threading.Thread.Sleep(300);

            this.Invoke((Action)(() => ShowCompleteUI(installPath, appExePath)));
        }

        private void UpdateProgressUI(int value, string main, string detail)
        {
            try
            {
                this.Invoke((Action)(() =>
                {
                    progressBar.Value = value;
                    if (!string.IsNullOrEmpty(main)) lblProgress.Text = main;
                    lblProgressDetail.Text = detail;
                }));
            }
            catch { }
        }

        // 文件结构：[原 EXE][Uninstall.exe][4字节 uninstall长度][app.zip][4字节 zip长度][标记]
        private EmbeddedData ReadEmbeddedData()
        {
            byte[] allBytes = File.ReadAllBytes(Application.ExecutablePath);
            byte[] markerBytes = Encoding.ASCII.GetBytes(MARKER);
            if (allBytes.Length < markerBytes.Length + 8) return null;

            int markerPos = -1;
            for (int i = allBytes.Length - markerBytes.Length; i >= 0; i--)
            {
                bool match = true;
                for (int j = 0; j < markerBytes.Length; j++)
                {
                    if (allBytes[i + j] != markerBytes[j]) { match = false; break; }
                }
                if (match) { markerPos = i; break; }
            }
            if (markerPos < 0) return null;

            int zipLenOffset = markerPos - 4;
            if (zipLenOffset < 0) return null;
            int zipLen = BitConverter.ToInt32(allBytes, zipLenOffset);

            int zipDataEnd = zipLenOffset;
            int zipDataStart = zipDataEnd - zipLen;
            if (zipDataStart < 0) return null;

            int uninstallLenOffset = zipDataStart - 4;
            if (uninstallLenOffset < 0) return null;
            int uninstallLen = BitConverter.ToInt32(allBytes, uninstallLenOffset);

            int uninstallStart = uninstallLenOffset - uninstallLen;
            if (uninstallStart < 0) return null;

            byte[] uninstallBytes = new byte[uninstallLen];
            Array.Copy(allBytes, uninstallStart, uninstallBytes, 0, uninstallLen);

            byte[] zipBytes = new byte[zipLen];
            Array.Copy(allBytes, zipDataStart, zipBytes, 0, zipLen);

            return new EmbeddedData { UninstallBytes = uninstallBytes, ZipBytes = zipBytes };
        }

        private void CreateShortcut(string shortcutPath, string targetPath,
            string workingDir, string description, string iconPath)
        {
            try
            {
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType == null) return;
                dynamic shell = Activator.CreateInstance(shellType);
                dynamic shortcut = shell.CreateShortcut(shortcutPath);
                shortcut.TargetPath = targetPath;
                shortcut.WorkingDirectory = workingDir;
                shortcut.Description = description;
                shortcut.WindowStyle = 1;
                if (!string.IsNullOrEmpty(iconPath) && File.Exists(iconPath))
                    shortcut.IconLocation = iconPath;
                shortcut.Save();
                Marshal.ReleaseComObject(shortcut);
                Marshal.ReleaseComObject(shell);
            }
            catch { }
        }

        private void ShowCompleteUI(string installPath, string appExePath)
        {
            isInstalling = false;
            phase = "done";

            progressBar.Visible = false;
            lblProgress.Visible = false;
            lblProgressDetail.Visible = false;

            picIcon.Visible = false;
            lblHeroTitle.Text = "安装完成";
            lblHeroSub.Text = "一切就绪，开始使用吧";
            pnlHero.Invalidate();

            // 完成信息面板
            pnlDone = new Panel
            {
                BackColor = CPanel,
                Location = new Point(32, 204),
                Size = new Size(496, 220),
            };
            using (var path = RoundedPath(new Rectangle(0, 0, pnlDone.Width, pnlDone.Height), 8))
                pnlDone.Region = new Region(path);

            var lblDoneTitle = new Label
            {
                Text = "安装位置",
                Font = new Font("Microsoft YaHei UI", 9.5F, FontStyle.Bold),
                ForeColor = CText,
                Location = new Point(24, 22),
                Size = new Size(200, 20),
                BackColor = Color.Transparent,
            };
            pnlDone.Controls.Add(lblDoneTitle);

            var lblDonePath = new Label
            {
                Text = installPath,
                Font = new Font("Consolas", 9F),
                ForeColor = CTextLt,
                Location = new Point(24, 48),
                Size = new Size(448, 24),
                BackColor = Color.Transparent,
                AutoEllipsis = true,
            };
            pnlDone.Controls.Add(lblDonePath);

            var btnLaunch = new GButton
            {
                Text = "立即启动",
                Kind = GButton.BtnKind.Success,
                Location = new Point(24, 92),
                Size = new Size(130, 40),
            };
            btnLaunch.Click += (s, e) =>
            {
                try
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = appExePath,
                        WorkingDirectory = installPath,
                        UseShellExecute = true,
                    });
                    this.Close();
                }
                catch (Exception ex)
                {
                    MessageBox.Show(this, "启动失败:\n" + ex.Message,
                        "提示", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                }
            };
            pnlDone.Controls.Add(btnLaunch);

            this.Controls.Add(pnlDone);
            pnlDone.BringToFront();

            btnInstall.Text = "完成";
            btnInstall.Enabled = true;
            btnCancel.Visible = false;
        }

        private void ResetUIAfterFailure()
        {
            isInstalling = false;
            phase = "welcome";
            btnInstall.Enabled = true;
            btnInstall.Text = "开始安装";
            btnCancel.Enabled = true;
            btnCancel.Visible = true;

            lblHeroTitle.Text = "班级服务管理系统";
            lblHeroSub.Text = "版本 3.5.2  ·  请选择安装位置";
            picIcon.Visible = true;
            pnlHero.Invalidate();

            lblPathTitle.Visible = true;
            txtPath.Visible = true;
            btnBrowse.Visible = true;
            chkDesktopShortcut.Visible = true;
            txtPath.SetEnabled(true);
            btnBrowse.Enabled = true;
            chkDesktopShortcut.Enabled = true;

            progressBar.Visible = false;
            lblProgress.Visible = false;
            lblProgressDetail.Visible = false;
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
        private static readonly Color G1 = Color.FromArgb(14, 122, 13);
        private static readonly Color G2 = Color.FromArgb(12, 95, 12);
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
            using (var path = InstallerForm.RoundedPath(new Rectangle(0, 0, Width, Height), radius))
                Region = new Region(path);
        }

        protected override void OnPaint(PaintEventArgs pevent)
        {
            var g = pevent.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            var rect = new Rectangle(0, 0, Width - 1, Height - 1);

            Color a, b; Color textColor;

            if (!Enabled)
            {
                using (var br = new SolidBrush(Color.FromArgb(240, 240, 240)))
                using (var path = InstallerForm.RoundedPath(rect, radius))
                    g.FillPath(br, path);
                using (var pen = new Pen(Color.FromArgb(224, 224, 224), 1))
                using (var path = InstallerForm.RoundedPath(rect, radius))
                    g.DrawPath(pen, path);
                TextRenderer.DrawText(g, Text, Font, ClientRectangle, Color.FromArgb(166, 166, 166),
                    TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
                return;
            }

            switch (Kind)
            {
                case BtnKind.Secondary:
                    using (var br = new SolidBrush(hover ? Color.FromArgb(245, 245, 245) : Color.White))
                    using (var path = InstallerForm.RoundedPath(rect, radius))
                        g.FillPath(br, path);
                    using (var pen = new Pen(Color.FromArgb(209, 209, 209), 1))
                    using (var path = InstallerForm.RoundedPath(rect, radius))
                        g.DrawPath(pen, path);
                    textColor = Color.FromArgb(27, 27, 27);
                    TextRenderer.DrawText(g, Text, Font, ClientRectangle, textColor,
                        TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
                    return;
                case BtnKind.Success: a = G1; b = G2; break;
                case BtnKind.Danger:  a = R1; b = R2; break;
                default:              a = C1; b = C2; break;
            }

            using (var br = new SolidBrush(a))
            using (var path = InstallerForm.RoundedPath(rect, radius))
                g.FillPath(br, path);
            if (hover)
            {
                using (var br = new SolidBrush(b))
                using (var path = InstallerForm.RoundedPath(rect, radius))
                    g.FillPath(br, path);
            }
            TextRenderer.DrawText(g, Text, new Font(Font, FontStyle.Bold), ClientRectangle, Color.White,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        }
    }

    // ─────────────────────────────────────────────
    //  圆角输入框（带聚焦高亮）
    // ─────────────────────────────────────────────
    class GInput : Panel
    {
        private TextBox tb;
        private bool focused = false;
        private int radius = 6;

        public event EventHandler InnerTextChanged;

        public GInput()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint |
                     ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            BackColor = Color.White;

            tb = new TextBox
            {
                BorderStyle = BorderStyle.None,
                Font = new Font("Microsoft YaHei UI", 10F),
                BackColor = Color.White,
                ForeColor = Color.FromArgb(27, 27, 27),
                Location = new Point(12, 10),
                Width = 406,
            };
            tb.GotFocus += (s, e) => { focused = true; Invalidate(); };
            tb.LostFocus += (s, e) => { focused = false; Invalidate(); };
            tb.TextChanged += (s, e) => { if (InnerTextChanged != null) InnerTextChanged(this, EventArgs.Empty); };
            Controls.Add(tb);
        }

        public string Text
        {
            get { return tb.Text; }
            set { tb.Text = value; }
        }

        public void SetEnabled(bool en)
        {
            tb.Enabled = en;
            tb.BackColor = en ? Color.White : Color.FromArgb(245, 245, 245);
            tb.BackColor = BackColor;
            Invalidate();
        }

        protected override void OnResize(EventArgs e)
        {
            base.OnResize(e);
            tb.Width = Width - 24;
            using (var path = InstallerForm.RoundedPath(new Rectangle(0, 0, Width, Height), radius))
                Region = new Region(path);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            using (var br = new SolidBrush(Enabled ? BackColor : Color.FromArgb(245, 245, 245)))
            using (var path = InstallerForm.RoundedPath(new Rectangle(0, 0, Width - 1, Height - 1), radius))
                g.FillPath(br, path);
            using (var pen = new Pen(focused ? Color.FromArgb(15, 108, 189) : Color.FromArgb(209, 209, 209), focused ? 2f : 1f))
            using (var path = InstallerForm.RoundedPath(new Rectangle(0, 0, Width - 1, Height - 1), radius))
                g.DrawPath(pen, path);
        }
    }

    // ─────────────────────────────────────────────
    //  自绘渐变进度条
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
            using (var path = InstallerForm.RoundedPath(rect, radius))
                g.FillPath(br, path);

            if (val > 0)
            {
                int fw = (int)((float)val / 100 * Width);
                if (fw < radius * 2) fw = radius * 2;
                var fill = new Rectangle(0, 0, fw, Height - 1);
                using (var br = new SolidBrush(C1))
                using (var path = InstallerForm.RoundedPath(fill, radius))
                    g.FillPath(br, path);
            }
        }
    }

    class EmbeddedData
    {
        public byte[] UninstallBytes;
        public byte[] ZipBytes;
    }
}
