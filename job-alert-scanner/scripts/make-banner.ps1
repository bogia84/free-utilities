Add-Type -AssemblyName System.Drawing

$W = 1200
$H = 800

$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

# background gradient
$bgRect = New-Object System.Drawing.Rectangle(0, 0, $W, $H)
$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $bgRect,
    [System.Drawing.Color]::FromArgb(255, 30, 64, 175),
    [System.Drawing.Color]::FromArgb(255, 13, 148, 136),
    35
)
$g.FillRectangle($bgBrush, $bgRect)

# soft decorative circles
$circleBrush1 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(28, 255, 255, 255))
$g.FillEllipse($circleBrush1, $W * 0.78, -120, 520, 520)
$circleBrush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(20, 255, 255, 255))
$g.FillEllipse($circleBrush2, -160, $H * 0.55, 480, 480)

# --- badge icon (briefcase + magnifier), left side ---
$iconSize = 300
$ix = 90
$iy = ($H - $iconSize) / 2 - 40

$iconBgPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$r = $iconSize * 0.22
$d = $r * 2
$iconBgPath.AddArc($ix, $iy, $d, $d, 180, 90)
$iconBgPath.AddArc($ix + $iconSize - $d, $iy, $d, $d, 270, 90)
$iconBgPath.AddArc($ix + $iconSize - $d, $iy + $iconSize - $d, $d, $d, 0, 90)
$iconBgPath.AddArc($ix, $iy + $iconSize - $d, $d, $d, 90, 90)
$iconBgPath.CloseFigure()
$iconBgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
$g.FillPath((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 255, 255, 255))), $iconBgPath)

$bw = $iconSize * 0.52
$bh = $iconSize * 0.36
$bx = $ix + ($iconSize - $bw) / 2
$by = $iy + $iconSize * 0.40
$caseRadius = $iconSize * 0.06
$casePath = New-Object System.Drawing.Drawing2D.GraphicsPath
$cd = $caseRadius * 2
$casePath.AddArc($bx, $by, $cd, $cd, 180, 90)
$casePath.AddArc($bx + $bw - $cd, $by, $cd, $cd, 270, 90)
$casePath.AddArc($bx + $bw - $cd, $by + $bh - $cd, $cd, $cd, 0, 90)
$casePath.AddArc($bx, $by + $bh - $cd, $cd, $cd, 90, 90)
$casePath.CloseFigure()
$g.FillPath([System.Drawing.Brushes]::White, $casePath)

$handleW = $iconSize * 0.22
$handleH = $iconSize * 0.14
$hx = $ix + ($iconSize - $handleW) / 2
$hy = $by - $handleH * 0.62
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 8)
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$handleRect = New-Object System.Drawing.RectangleF($hx, $hy, $handleW, $handleH)
$g.DrawArc($pen, $handleRect, 180, 180)

$claspBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 30, 64, 175))
$claspW = $iconSize * 0.10
$claspH = $iconSize * 0.08
$g.FillRectangle($claspBrush, $ix + ($iconSize - $claspW) / 2, $by + $bh * 0.36, $claspW, $claspH)

$badgeR = $iconSize * 0.30
$badgeCx = $ix + $iconSize * 0.76
$badgeCy = $iy + $iconSize * 0.78
$badgeBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 234, 88, 12))
$g.FillEllipse($badgeBrush, $badgeCx - $badgeR, $badgeCy - $badgeR, $badgeR * 2, $badgeR * 2)

$glassPen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 9)
$glassPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$glassPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$lensR = $badgeR * 0.46
$lensCx = $badgeCx - $badgeR * 0.12
$lensCy = $badgeCy - $badgeR * 0.12
$g.DrawEllipse($glassPen, $lensCx - $lensR, $lensCy - $lensR, $lensR * 2, $lensR * 2)
$g.DrawLine($glassPen, $lensCx + $lensR * 0.72, $lensCy + $lensR * 0.72, $badgeCx + $badgeR * 0.42, $badgeCy + $badgeR * 0.42)

# --- text, right side ---
$textX = 440
$titleFont = New-Object System.Drawing.Font("Segoe UI", 54, [System.Drawing.FontStyle]::Bold)
$g.DrawString("Job Alert Scanner", $titleFont, [System.Drawing.Brushes]::White, $textX, 230)

$taglineFont = New-Object System.Drawing.Font("Segoe UI", 22, [System.Drawing.FontStyle]::Regular)
$taglineBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(235, 255, 255, 255))
$g.DrawString("Never miss a new job posting again.", $taglineFont, $taglineBrush, $textX, 320)
$g.DrawString("Set your role, pick a refresh interval, get notified.", $taglineFont, $taglineBrush, $textX, 360)

# site chips
$chips = @("ITviec", "VietnamWorks", "LinkedIn")
$chipFont = New-Object System.Drawing.Font("Segoe UI", 20, [System.Drawing.FontStyle]::Bold)
$chipY = 460
$chipX = $textX
foreach ($chip in $chips) {
    $textSize = $g.MeasureString($chip, $chipFont)
    $chipW = $textSize.Width + 56
    $chipH = 58
    $chipPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $cr = $chipH / 2
    $ccd = $cr * 2
    $chipPath.AddArc($chipX, $chipY, $ccd, $ccd, 90, 180)
    $chipPath.AddArc($chipX + $chipW - $ccd, $chipY, $ccd, $ccd, 270, 180)
    $chipPath.CloseFigure()
    $g.FillPath((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(50, 255, 255, 255))), $chipPath)
    $g.DrawString($chip, $chipFont, [System.Drawing.Brushes]::White, $chipX + 28, $chipY + 14)
    $chipX += $chipW + 20
}

$bmp.Save((Join-Path $PSScriptRoot "..\store\banner-1200x800.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Output "Banner generated."
