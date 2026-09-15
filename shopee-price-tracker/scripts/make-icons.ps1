Add-Type -AssemblyName System.Drawing

function New-Icon {
    param(
        [int]$Size,
        [string]$Path
    )

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # background: rounded square gradient (Shopee orange)
    $rect = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(255, 245, 61, 45),
        [System.Drawing.Color]::FromArgb(255, 238, 77, 45),
        45
    )
    $radius = [int]($Size * 0.22)
    $bgPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $radius * 2
    $bgPath.AddArc(0, 0, $d, $d, 180, 90)
    $bgPath.AddArc($Size - $d, 0, $d, $d, 270, 90)
    $bgPath.AddArc($Size - $d, $Size - $d, $d, $d, 0, 90)
    $bgPath.AddArc(0, $Size - $d, $d, $d, 90, 90)
    $bgPath.CloseFigure()
    $g.FillPath($bgBrush, $bgPath)

    # shopping bag body (white, trapezoid with rounded bottom corners)
    $bw = $Size * 0.48
    $bh = $Size * 0.40
    $bx = ($Size - $bw) / 2
    $by = $Size * 0.42
    $bagRadius = $Size * 0.06
    $bagPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $bd = $bagRadius * 2
    $bagPath.AddArc($bx, $by, $bd, $bd, 180, 90)
    $bagPath.AddArc($bx + $bw - $bd, $by, $bd, $bd, 270, 90)
    $bagPath.AddArc($bx + $bw - $bd, $by + $bh - $bd, $bd, $bd, 0, 90)
    $bagPath.AddArc($bx, $by + $bh - $bd, $bd, $bd, 90, 90)
    $bagPath.CloseFigure()
    $g.FillPath([System.Drawing.Brushes]::White, $bagPath)

    # bag handle
    $handleW = $Size * 0.22
    $handleH = $Size * 0.16
    $hx = ($Size - $handleW) / 2
    $hy = $by - $handleH * 0.68
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [Math]::Max(1.5, $Size * 0.045))
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $handleRect = New-Object System.Drawing.RectangleF($hx, $hy, $handleW, $handleH)
    $g.DrawArc($pen, $handleRect, 180, 180)

    if ($Size -ge 32) {
        # price-trend badge, bottom-right: dark circle with a zigzag line + dot
        $badgeR = $Size * 0.30
        $badgeCx = $Size * 0.76
        $badgeCy = $Size * 0.78
        $badgeBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 33, 37, 41))
        $g.FillEllipse($badgeBrush, $badgeCx - $badgeR, $badgeCy - $badgeR, $badgeR * 2, $badgeR * 2)

        $linePen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [Math]::Max(1.4, $Size * 0.028))
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
        $dotR = $Size * 0.028
        $g.FillEllipse([System.Drawing.Brushes]::White, $px4 - $dotR, $py4 - $dotR, $dotR * 2, $dotR * 2)
    }

    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

$iconsDir = Join-Path $PSScriptRoot "..\icons"
New-Icon -Size 16 -Path (Join-Path $iconsDir "icon16.png")
New-Icon -Size 48 -Path (Join-Path $iconsDir "icon48.png")
New-Icon -Size 128 -Path (Join-Path $iconsDir "icon128.png")
Write-Output "Icons generated."
