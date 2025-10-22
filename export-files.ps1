# Script to export WaveformVisualizer.tsx and page.tsx to a text file
# Created: October 22, 2025

$outputFile = "exported-files.txt"
$separator = "=" * 80

# Clear the output file if it exists
if (Test-Path $outputFile) {
    Remove-Item $outputFile
}

# Function to add file content to output
function Export-FileContent {
    param (
        [string]$FilePath,
        [string]$DisplayName
    )
    
    if (Test-Path $FilePath) {
        # Add header
        Add-Content -Path $outputFile -Value "`n$separator"
        Add-Content -Path $outputFile -Value "FILE: $DisplayName"
        Add-Content -Path $outputFile -Value "PATH: $FilePath"
        Add-Content -Path $outputFile -Value $separator
        Add-Content -Path $outputFile -Value ""
        
        # Add file content
        Get-Content -Path $FilePath | Add-Content -Path $outputFile
        
        # Add footer
        Add-Content -Path $outputFile -Value ""
        Add-Content -Path $outputFile -Value $separator
        Add-Content -Path $outputFile -Value "END OF FILE: $DisplayName"
        Add-Content -Path $outputFile -Value $separator
        Add-Content -Path $outputFile -Value ""
        
        Write-Host "✓ Exported: $DisplayName" -ForegroundColor Green
    } else {
        Write-Host "✗ File not found: $FilePath" -ForegroundColor Red
    }
}

# Export files
Write-Host "`nExporting files to $outputFile..." -ForegroundColor Cyan

Export-FileContent -FilePath "frontend\app\components\WaveformVisualizer.tsx" -DisplayName "WaveformVisualizer.tsx"
Export-FileContent -FilePath "frontend\app\page.tsx" -DisplayName "page.tsx"

Write-Host "`nExport complete! Output saved to: $outputFile" -ForegroundColor Green
Write-Host "Total lines: $((Get-Content $outputFile).Count)" -ForegroundColor Cyan
