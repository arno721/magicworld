$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$size = 1024
$outDir = Join-Path (Get-Location) 'assets\textures'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$names = @(
    'grass_top','grass_side','dirt','stone','wood_side','wood_top','leaves','sand','planks','cobblestone','brick','gravel','snow','coal_ore','iron_ore','gold_ore','diamond_ore','water','bedrock','glass','stone_brick','crafting_table_top','crafting_table_side','furnace_top','furnace_side','stick_item','coal_item'
)

$palette = @{
    grass_top = [int[]](52,132,66)
    grass_side = [int[]](78,128,54)
    dirt = [int[]](95,72,39)
    stone = [int[]](118,118,118)
    wood_side = [int[]](117,87,52)
    wood_top = [int[]](132,101,61)
    leaves = [int[]](44,114,36)
    sand = [int[]](219,205,159)
    planks = [int[]](156,114,61)
    cobblestone = [int[]](108,108,108)
    brick = [int[]](160,92,56)
    gravel = [int[]](132,130,126)
    snow = [int[]](235,235,238)
    coal_ore = [int[]](70,70,70)
    iron_ore = [int[]](184,163,129)
    gold_ore = [int[]](235,212,86)
    diamond_ore = [int[]](113,218,235)
    water = [int[]](68,142,206)
    bedrock = [int[]](35,35,35)
    glass = [int[]](178,225,255)
    stone_brick = [int[]](127,127,129)
    crafting_table_top = [int[]](130,90,50)
    crafting_table_side = [int[]](108,85,50)
    furnace_top = [int[]](124,124,124)
    furnace_side = [int[]](90,90,90)
    stick_item = [int[]](127,96,54)
    coal_item = [int[]](35,35,35)
}

function SeedFromString([string]$s) {
    $h = 2166136261
    foreach ($ch in $s.ToCharArray()) {
        $h = ([int64]$h * 131 + [int][char]$ch) % 2147483647
    }
    if ($h -le 0) { $h = 1; }
    return [int]$h
}

function NewRandomColor([System.Drawing.Color]$base, [System.Random]$rng, [int]$variation, [int]$alpha) {
    $r = [Math]::Max(0, [Math]::Min(255, $base.R + $rng.Next(-$variation, $variation + 1)))
    $g = [Math]::Max(0, [Math]::Min(255, $base.G + $rng.Next(-$variation, $variation + 1)))
    $b = [Math]::Max(0, [Math]::Min(255, $base.B + $rng.Next(-$variation, $variation + 1)))
    return [System.Drawing.Color]::FromArgb($alpha, $r, $g, $b)
}

function DrawNoise([System.Drawing.Graphics]$g, [System.Drawing.Color]$c, [int]$w, [int]$h, [int]$passes, [int]$maxRadius, [System.Random]$rng, [int]$alphaMin, [int]$alphaMax) {
    for ($i = 0; $i -lt $passes; $i++) {
        $r = $rng.Next(1, [Math]::Max(2, $maxRadius))
        $x = $rng.Next(-$r, $w + $r)
        $y = $rng.Next(-$r, $h + $r)
        $alpha = $rng.Next($alphaMin, $alphaMax + 1)
        $col = NewRandomColor $c $rng 28 $alpha
        $brush = New-Object System.Drawing.SolidBrush $col
        $g.FillEllipse($brush, $x, $y, $r, $r)
        $brush.Dispose()
    }
}

function DrawStripes([System.Drawing.Graphics]$g, [System.Drawing.Color]$c, [int]$w, [int]$h, [int]$count, [System.Random]$rng, [int]$baseAlpha = 32) {
    for ($i=0;$i -lt $count; $i++) {
        $th = $rng.Next(1,5)
        $y = $rng.Next(0,$h)
        $y2 = $y + $rng.Next(-8,8)
        $col = [System.Drawing.Color]::FromArgb($baseAlpha, $c.R, $c.G, $c.B)
        $pen = New-Object System.Drawing.Pen $col, $th
        $g.DrawLine($pen, 0, $y, $w, $y2)
        $pen.Dispose()
    }
}

function DrawBrickPattern([System.Drawing.Graphics]$g, [System.Drawing.Color]$c, [int]$w, [int]$h, [System.Random]$rng) {
    $tileW = 72
    $tileH = 36
    for ($y = -$tileH; $y -lt $h + $tileH; $y += $tileH) {
        for ($x = -$tileW; $x -lt $w + $tileW; $x += $tileW) {
            if ((($y / $tileH) % 2) -eq 0) {
                $ox = $x
            } else {
                $ox = $x + ($tileW / 2)
            }
            $col = [Math]::Max(0,[Math]::Min(255, $c.R + $rng.Next(-20, 20)))
            $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(70, $col, $col, $c.B), $rng.Next(1,4))
            $g.DrawRectangle($pen, $ox, $y, $tileW - 8, $tileH - 6)
            $pen.Dispose()
        }
    }
}

foreach ($name in $names) {
    $base = $palette[$name]
    $c0 = [System.Drawing.Color]::FromArgb(255, $base[0], $base[1], $base[2])
    $seed = SeedFromString($name)
    $rng = New-Object System.Random $seed

    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighSpeed
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    switch ($name) {
        'grass_top' {
            $g.Clear([System.Drawing.Color]::FromArgb(255, 34, 124, 36))
            DrawNoise $g ([System.Drawing.Color]::FromArgb(255, 40, 190, 52)) $size $size 2200 90 $rng 20 90
            DrawStripes $g ([System.Drawing.Color]::FromArgb(255, 20, 90, 14)) $size $size 120 $rng 28
            for($i=0;$i -lt 30;$i++){
                $x=$rng.Next(0,$size);$y=$rng.Next(0,$size);$r=$rng.Next(8,32)
                $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($rng.Next(120,200),200,$rng.Next(220,255),95))
                $g.FillRectangle($brush, $x-$r, $y-$r, $r, $r)
                $brush.Dispose()
            }
        }
        'grass_side' {
            $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush([System.Drawing.Rectangle]::new(0,0,$size,$size), [System.Drawing.Color]::FromArgb(255,90,150,55), [System.Drawing.Color]::FromArgb(255,63,101,39), [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
            $g.FillRectangle($brush, 0, 0, $size, $size)
            $brush.Dispose()
            DrawNoise $g ([System.Drawing.Color]::FromArgb(255,55,125,47)) $size $size 1700 65 $rng 16 90
            DrawStripes $g ([System.Drawing.Color]::FromArgb(255,40,90,30)) $size $size 60 $rng 18
        }
        'dirt' {
            $g.Clear([System.Drawing.Color]::FromArgb(255,100,73,38))
            DrawNoise $g ([System.Drawing.Color]::FromArgb(255,140,100,60)) $size $size 2000 120 $rng 14 76
        }
        'stone' {
            $g.Clear([System.Drawing.Color]::FromArgb(255,110,110,110))
            DrawNoise $g ([System.Drawing.Color]::FromArgb(255,90,90,90)) $size $size 2600 160 $rng 12 70
            DrawStripes $g ([System.Drawing.Color]::FromArgb(255,150,150,150)) $size $size 420 $rng 20
        }
        'wood_side' {
            $g.Clear([System.Drawing.Color]::FromArgb(255,112,80,52))
            DrawStripes $g ([System.Drawing.Color]::FromArgb(255,170,120,70)) $size $size 1100 $rng 25
            DrawNoise $g ([System.Drawing.Color]::FromArgb(255,95,68,40)) $size $size 800 80 $rng 20 90
        }
        'wood_top' {
            $g.Clear([System.Drawing.Color]::FromArgb(255,131,98,63))
            for($i=0;$i -lt 250;$i++) {
                $x=$rng.Next(0,$size);$y=$rng.Next(0,$size);$r=$rng.Next(20,100)
                $col=[System.Drawing.Color]::FromArgb(160,$rng.Next(100,150),$rng.Next(75,120),$rng.Next(50,80))
                $g.FillEllipse((New-Object System.Drawing.SolidBrush($col)), $x-$r, $y, $r, $r)
            }
            DrawNoise $g ([System.Drawing.Color]::FromArgb(255,155,115,75)) $size $size 700 65 $rng 18 72
        }
        'leaves' {
            $g.Clear([System.Drawing.Color]::FromArgb(120,56,118,45))
            for($i=0;$i -lt 900;$i++){
                $x=$rng.Next(0,$size);$y=$rng.Next(0,$size);$s=$rng.Next(8,64)
                $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($rng.Next(10,140),$rng.Next(35,45),$rng.Next(115,140),$rng.Next(35,45)))
                $g.FillEllipse($brush, $x, $y, $s, $s)
                $brush.Dispose()
            }
        }
        'sand' {
            $g.Clear([System.Drawing.Color]::FromArgb(255,222,209,163))
            DrawNoise $g ([System.Drawing.Color]::FromArgb(255,240,226,185)) $size $size 1400 90 $rng 20 90
            DrawStripes $g ([System.Drawing.Color]::FromArgb(255,190,176,130)) $size $size 160 $rng 24
        }
        'planks' {
            $g.Clear([System.Drawing.Color]::FromArgb(255,166,118,69))
            $tile=92
            for($y=0;$y -lt $size;$y += $tile){
                if ((($y / $tile) % 2) -eq 0) { $off = 0 } else { $off = 48 }
                for($x=-$tile;$x -lt $size+$tile;$x += $tile){
                    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(45,80,60,35), $rng.Next(3,8))
                    $g.DrawLine($pen, $x + $off, $y, $x + $off + $size * 1.3, $y + 7)
                    $pen.Dispose()
                }
            }
            DrawNoise $g ([System.Drawing.Color]::FromArgb(255,135,95,58)) $size $size 900 90 $rng 18 85
        }
        'cobblestone' {
            $g.Clear([System.Drawing.Color]::FromArgb(255,114,112,112))
            DrawNoise $g ([System.Drawing.Color]::FromArgb(255,145,142,142)) $size $size 2700 140 $rng 8 90
        }
        'brick' {
            $g.Clear([System.Drawing.Color]::FromArgb(255,160,98,67))
            DrawBrickPattern $g ([System.Drawing.Color]::FromArgb(255,122,88,58)) $size $size $rng
        }
        'gravel' {
            $g.Clear([System.Drawing.Color]::FromArgb(255,130,130,130))
            DrawNoise $g ([System.Drawing.Color]::FromArgb(255,160,152,148)) $size $size 2600 90 $rng 15 85
        }
        'snow' {
            $g.Clear([System.Drawing.Color]::FromArgb(255,246,246,248))
            DrawNoise $g ([System.Drawing.Color]::FromArgb(255,235,235,240)) $size $size 1800 80 $rng 20 90
            for($i=0;$i -lt 4000;$i++){ 
                $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($rng.Next(80,170),255,255,255))
                $g.FillEllipse($brush, $rng.Next(0,$size), $rng.Next(0,$size), 3, 3)
                $brush.Dispose()
            }
        }
        'coal_ore' {
            $g.Clear([System.Drawing.Color]::FromArgb(255,118,118,122))
            DrawNoise $g ([System.Drawing.Color]::FromArgb(255,90,90,90)) $size $size 2400 120 $rng 8 90
            for($i=0;$i -lt 260;$i++){
                $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($rng.Next(50,220),45,45,45))
                $g.FillEllipse($brush, $rng.Next(0,$size), $rng.Next(0,$size), 26, 26)
                $brush.Dispose()
            }
        }
        'iron_ore' {
            $g.Clear([System.Drawing.Color]::FromArgb(255,130,130,128))
            DrawNoise $g ([System.Drawing.Color]::FromArgb(255,170,156,134)) $size $size 2200 130 $rng 10 85
            for($i=0;$i -lt 220;$i++){
                $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($rng.Next(70,180),180,160,130))
                $g.FillRectangle($brush, $rng.Next(0,$size), $rng.Next(0,$size), $rng.Next(10,36), $rng.Next(10,36))
                $brush.Dispose()
            }
        }
        'gold_ore' {
            $g.Clear([System.Drawing.Color]::FromArgb(255,124,106,64))
            DrawNoise $g ([System.Drawing.Color]::FromArgb(255,168,143,74)) $size $size 2100 130 $rng 10 80
            for($i=0;$i -lt 200;$i++){
                $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($rng.Next(70,160),223,196,98))
                $g.FillEllipse($brush, $rng.Next(0,$size), $rng.Next(0,$size), $rng.Next(8,48), $rng.Next(6,42))
                $brush.Dispose()
            }
        }
        'diamond_ore' {
            $g.Clear([System.Drawing.Color]::FromArgb(255,124,124,128))
            DrawNoise $g ([System.Drawing.Color]::FromArgb(255,156,145,118)) $size $size 2100 130 $rng 10 80
            for($i=0;$i -lt 180;$i++){
                $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($rng.Next(70,170),120,220,255))
                $g.FillEllipse($brush, $rng.Next(0,$size), $rng.Next(0,$size), $rng.Next(6,34), $rng.Next(6,34))
                $brush.Dispose()
            }
        }
        'water' {
            $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush([System.Drawing.Rectangle]::new(0,0,$size,$size), [System.Drawing.Color]::FromArgb(170,72,162,232), [System.Drawing.Color]::FromArgb(220,130,206,255), [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
            $g.FillRectangle($brush, 0, 0, $size, $size)
            $brush.Dispose()
            for($i=0;$i -lt 500;$i++){
                $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($rng.Next(40,120),255,255,255))
                $g.FillRectangle($brush, $rng.Next(0,$size), $rng.Next(0,$size), $rng.Next(20,280), $rng.Next(2,8))
                $brush.Dispose()
            }
        }
        'bedrock' {
            $g.Clear([System.Drawing.Color]::FromArgb(255,30,30,30))
            for($i=0;$i -lt 2800;$i++){
                $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($rng.Next(180,255), $rng.Next(30,70), $rng.Next(30,70), $rng.Next(30,70)))
                $g.FillEllipse($brush, $rng.Next(0,$size), $rng.Next(0,$size), $rng.Next(2,24), $rng.Next(2,24))
                $brush.Dispose()
            }
            DrawStripes $g ([System.Drawing.Color]::FromArgb(255,20,20,20)) $size $size 300 $rng 18
        }
        'glass' {
            $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush([System.Drawing.Rectangle]::new(0,0,$size,$size), [System.Drawing.Color]::FromArgb(80,180,230,255), [System.Drawing.Color]::FromArgb(35,255,255,255), [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
            $g.FillRectangle($brush, 0, 0, $size, $size)
            $brush.Dispose()
            for($i=0;$i -lt 8000;$i++){
                $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($rng.Next(8,35),255,255,255))
                $g.FillRectangle($brush, $rng.Next(0,$size),$rng.Next(0,$size),$rng.Next(2,12),$rng.Next(2,12))
                $brush.Dispose()
            }
            $bmp.MakeTransparent([System.Drawing.Color]::FromArgb(0,0,0,0))
        }
        'stone_brick' {
            $g.Clear([System.Drawing.Color]::FromArgb(255,124,124,126))
            DrawBrickPattern $g ([System.Drawing.Color]::FromArgb(255,122,122,126)) $size $size $rng
        }
        'crafting_table_top' {
            $g.Clear([System.Drawing.Color]::FromArgb(255,126,90,50))
            DrawStripes $g ([System.Drawing.Color]::FromArgb(255,150,110,70)) $size $size 600 $rng 20
        }
        'crafting_table_side' {
            $g.Clear([System.Drawing.Color]::FromArgb(255,108,80,49))
            DrawNoise $g ([System.Drawing.Color]::FromArgb(255,90,63,36)) $size $size 1200 96 $rng 18 90
        }
        'furnace_top' {
            $g.Clear([System.Drawing.Color]::FromArgb(255,122,122,122))
            DrawStripes $g ([System.Drawing.Color]::FromArgb(255,145,145,145)) $size $size 700 $rng 30
            DrawNoise $g ([System.Drawing.Color]::FromArgb(255,95,95,95)) $size $size 1300 100 $rng 12 85
        }
        'furnace_side' {
            $g.Clear([System.Drawing.Color]::FromArgb(255,92,92,92))
            DrawNoise $g ([System.Drawing.Color]::FromArgb(255,70,70,70)) $size $size 1500 100 $rng 10 85
        }
        'stick_item' {
            $g.Clear([System.Drawing.Color]::Transparent)
            $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $p1 = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255,105,80,40), 38)
            $p2 = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255,105,80,40), 22)
            $g.DrawLine($p1, $size * 0.35, $size * 0.18, $size * 0.65, $size * 0.9)
            $g.DrawLine($p2, $size * 0.35 + 70, $size * 0.18 + 100, $size * 0.65 - 60, $size * 0.9 + 40)
            $p1.Dispose(); $p2.Dispose()
            DrawStripes $g ([System.Drawing.Color]::FromArgb(120,130,95,54)) $size $size 30 $rng 14
            $bmp.MakeTransparent([System.Drawing.Color]::FromArgb(0,0,0,0))
        }
        'coal_item' {
            $g.Clear([System.Drawing.Color]::Transparent)
            $g.FillEllipse((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255,35,35,35))), $size*0.16, $size*0.14, $size*0.68, $size*0.68)
            for($i=0;$i -lt 2600;$i++){
                $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($rng.Next(70,220),$rng.Next(120,255),$rng.Next(120,255),$rng.Next(120,255)))
                $g.FillEllipse($brush, $rng.Next(80,$size-80), $rng.Next(80,$size-80), $rng.Next(6,26), $rng.Next(6,26))
                $brush.Dispose()
            }
            $g.FillEllipse((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(220,248,236,180))), $size*0.54, $size*0.34, 120, 60)
            $bmp.MakeTransparent([System.Drawing.Color]::FromArgb(0,0,0,0))
        }
    }

    $path = Join-Path $outDir ($name + '.png')
    $bmp.Save($path,[System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

"generated $($names.Count) textures to $outDir"
