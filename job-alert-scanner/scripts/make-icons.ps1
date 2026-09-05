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

    # background: rounded square gradient (blue -> teal)
    $rect = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(255, 37, 99, 235),
        [System.Drawing.Color]::FromArgb(255, 13, 160, 158),
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

    # briefcase body
    $bw = $Size * 0.52
    $bh = $Size * 0.36
    $bx = ($Size - $bw) / 2
    $by = $Size * 0.40
    $caseBrush = [System.Drawing.Brushes]::White
    $caseRect = New-Object System.Drawing.RectangleF($bx, $by, $bw, $bh)
    $caseRadius = $Size * 0.06
    $casePath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $cd = $caseRadius * 2
    $casePath.AddArc($bx, $by, $cd, $cd, 180, 90)
    $casePath.AddArc($bx + $bw - $cd, $by, $cd, $cd, 270, 90)
    $casePath.AddArc($bx + $bw - $cd, $by + $bh - $cd, $cd, $cd, 0, 90)
    $casePath.AddArc($bx, $by + $bh - $cd, $cd, $cd, 90, 90)
    $casePath.CloseFigure()
    $g.FillPath($caseBrush, $casePath)

    # briefcase handle
    $handleW = $Size * 0.22
    $handleH = $Size * 0.14
    $hx = ($Size - $handleW) / 2
    $hy = $by - $handleH * 0.62
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [Math]::Max(1.5, $Size * 0.035))
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $handleRect = New-Object System.Drawing.RectangleF($hx, $hy, $handleW, $handleH)
    $g.DrawArc($pen, $handleRect, 180, 180)

    # briefcase clasp / center line
    $claspBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 37, 99, 235))
    $claspW = $Size * 0.10
    $claspH = $Size * 0.08
    $g.FillRectangle($claspBrush, ($Size - $claspW) / 2, $by + $bh * 0.36, $claspW, $claspH)

    if ($Size -ge 32) {
        # magnifying glass badge, bottom-right
        $badgeR = $Size * 0.30
        $badgeCx = $Size * 0.76
        $badgeCy = $Size * 0.78
        $badgeBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 234, 88, 12))
        $g.FillEllipse($badgeBrush, $badgeCx - $badgeR, $badgeCy - $badgeR, $badgeR * 2, $badgeR * 2)

        $glassPen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [Math]::Max(1.5, $Size * 0.035))
        $glassPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
        $glassPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
        $lensR = $badgeR * 0.46
        $lensCx = $badgeCx - $badgeR * 0.12
        $lensCy = $badgeCy - $badgeR * 0.12
        $g.DrawEllipse($glassPen, $lensCx - $lensR, $lensCy - $lensR, $lensR * 2, $lensR * 2)
        $g.DrawLine($glassPen,
            $lensCx + $lensR * 0.72, $lensCy + $lensR * 0.72,
            $badgeCx + $badgeR * 0.42, $badgeCy + $badgeR * 0.42)
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
