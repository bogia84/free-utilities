Add-Type -AssemblyName System.Drawing

$W = 1200
$H = 800

$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

# background gradient (Shopee orange)
$bgRect = New-Object System.Drawing.Rectangle(0, 0, $W, $H)
$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $bgRect,
    [System.Drawing.Color]::FromArgb(255, 245, 61, 45),
    [System.Drawing.Color]::FromArgb(255, 200, 40, 30),
    35
)
$g.FillRectangle($bgBrush, $bgRect)

# soft decorative circles
$circleBrush1 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(28, 255, 255, 255))
$g.FillEllipse($circleBrush1, $W * 0.78, -120, 520, 520)
$circleBrush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(20, 255, 255, 255))
$g.FillEllipse($circleBrush2, -160, $H * 0.55, 480, 480)

# --- badge icon (shopping bag + price-trend badge), left side ---
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
$g.FillPath((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 255, 255, 255))), $iconBgPath)

$bw = $iconSize * 0.48
$bh = $iconSize * 0.40
$bx = $ix + ($iconSize - $bw) / 2
$by = $iy + $iconSize * 0.42
$bagRadius = $iconSize * 0.06
$bagPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$bd = $bagRadius * 2
$bagPath.AddArc($bx, $by, $bd, $bd, 180, 90)
$bagPath.AddArc($bx + $bw - $bd, $by, $bd, $bd, 270, 90)
$bagPath.AddArc($bx + $bw - $bd, $by + $bh - $bd, $bd, $bd, 0, 90)
$bagPath.AddArc($bx, $by + $bh - $bd, $bd, $bd, 90, 90)
$bagPath.CloseFigure()
$g.FillPath([System.Drawing.Brushes]::White, $bagPath)

$handleW = $iconSize * 0.22
$handleH = $iconSize * 0.16
$hx = $ix + ($iconSize - $handleW) / 2
$hy = $by - $handleH * 0.68
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 8)
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$handleRect = New-Object System.Drawing.RectangleF($hx, $hy, $handleW, $handleH)
$g.DrawArc($pen, $handleRect, 180, 180)

$badgeR = $iconSize * 0.30
$badgeCx = $ix + $iconSize * 0.76
$badgeCy = $iy + $iconSize * 0.78
$badgeBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 33, 37, 41))
$g.FillEllipse($badgeBrush, $badgeCx - $badgeR, $badgeCy - $badgeR, $badgeR * 2, $badgeR * 2)

$linePen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 8)
$linePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$linePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$linePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$lw = $badgeR * 1.1
$lx0 = $badgeCx - $lw / 2
$ly0 = $badgeCy + $badgeR * 0.18
$px0 = $lx0
$py0 = $ly0
$px1 = $lx0 + $lw * 0.30
$py1 = $ly0 - $badgeR * 0.10
$px2 = $lx0 + $lw * 0.55
$py2 = $ly0 + $badgeR * 0.25
$px3 = $lx0 + $lw * 0.80
$py3 = $ly0 - $badgeR * 0.35
$px4 = $lx0 + $lw
$py4 = $ly0 - $badgeR * 0.55
$g.DrawLine($linePen, $px0, $py0, $px1, $py1)
$g.DrawLine($linePen, $px1, $py1, $px2, $py2)
$g.DrawLine($linePen, $px2, $py2, $px3, $py3)
$g.DrawLine($linePen, $px3, $py3, $px4, $py4)
$dotR = $iconSize * 0.028
$g.FillEllipse([System.Drawing.Brushes]::White, $px4 - $dotR, $py4 - $dotR, $dotR * 2, $dotR * 2)

# --- text, right side ---
$textX = 440
$titleFont = New-Object System.Drawing.Font("Segoe UI", 50, [System.Drawing.FontStyle]::Bold)
$g.DrawString("Shopee Price Tracker", $titleFont, [System.Drawing.Brushes]::White, $textX, 220)

$taglineFont = New-Object System.Drawing.Font("Segoe UI", 22, [System.Drawing.FontStyle]::Regular)
$taglineBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(235, 255, 255, 255))
$g.DrawString("Browse Shopee, click Track.", $taglineFont, $taglineBrush, $textX, 320)
$g.DrawString("We chart the price changes for you.", $taglineFont, $taglineBrush, $textX, 360)

# feature chips
$chips = @("One-click tracking", "Price chart", "Drop alerts")
$chipFont = New-Object System.Drawing.Font("Segoe UI", 18, [System.Drawing.FontStyle]::Bold)
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
