// Scripts/charts.js

/**
 * Gets theme colors from Bootstrap CSS variables
 * @returns {Object} Color palette based on current theme
 */
function getThemeColors() {
    // Get the root element to access CSS variables
    const root = document.documentElement;
    const computedStyle = getComputedStyle(root);
    
    // Helper to get CSS variable with fallback
    const getCSSVar = (varName, fallback) => {
        const value = computedStyle.getPropertyValue(varName).trim();
        return value || fallback;
    };
    
    // Extract Bootstrap theme colors
    // Convert hex/rgb to rgba for transparency support
    const colorToRgba = (color, alpha = 1) => {
        if (!color) return `rgba(0, 0, 0, ${alpha})`;
        
        // Handle RGB/RGBA values
        const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
        if (rgbMatch) {
            return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${alpha})`;
        }
        
        // Handle hex values
        let hex = color.replace('#', '');
        // Handle 3-digit hex
        if (hex.length === 3) {
            hex = hex.split('').map(c => c + c).join('');
        }
        if (hex.length === 6) {
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        
        // Fallback
        return `rgba(0, 0, 0, ${alpha})`;
    };
    
    // Get Bootstrap color variables
    const primary = getCSSVar('--bs-primary', '#0d6efd');
    const success = getCSSVar('--bs-success', '#198754');
    const danger = getCSSVar('--bs-danger', '#dc3545');
    const warning = getCSSVar('--bs-warning', '#ffc107');
    const info = getCSSVar('--bs-info', '#0dcaf0');
    
    // Return color palette with theme colors
    return {
        allocated: colorToRgba(danger, 0.8),      // Danger color for allocated payments
        available: colorToRgba(success, 0.8),    // Success color for available balance
        paid: colorToRgba(success, 0.8),         // Success color for paid
        unpaid: colorToRgba(warning, 0.8),        // Warning color for unpaid
        late: colorToRgba(danger, 0.8),          // Danger color for late
        primary: colorToRgba(primary, 0.8),       // Primary theme color
        info: colorToRgba(info, 0.6),            // Info color
        background: 'rgba(255, 255, 255, 0.1)'
    };
}

/**
 * Initializes and manages Chart.js charts for financial visualization
 * @returns {{updateCharts: function(number, number), updateTheme: function()}} 
 */
function initializeCharts() {
    // Get initial theme colors
    let chartColors = getThemeColors();

    // Get canvas elements
    const doughnutCanvas = document.getElementById('doughnutChart');
    const barCanvas = document.getElementById('barChart');

    if (!doughnutCanvas || !barCanvas) {
        console.error('Chart canvas elements not found');
        return null;
    }

    // Doughnut Chart - Shows allocation vs available balance
    const doughnutChart = new Chart(doughnutCanvas, {
        type: 'doughnut',
        data: {
            labels: ['Paid', 'Available'],
            datasets: [{
                data: [0, 0],
                backgroundColor: [chartColors.allocated, chartColors.available],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    //position: 'left',
                    align: 'start',
                    labels: {
                        padding: 8,
                        font: {
                            size: 10
                        },
                        boxWidth: 12,
                        boxHeight: 12,
                        textAlign: 'left'
                    }
                },
                layout: {
                    padding: {
                        left: 0
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            return ' $' + Math.round(value);
                        }
                    }
                }
            }
        }
    });

    // Bar Chart - Shows breakdown of payment status
    const barChart = new Chart(barCanvas, {
        type: 'bar',
        data: {
            labels: ['Paid', 'Unpaid', 'Late'],
            datasets: [{
                label: 'Amount ($)',
                data: [0, 0, 0],
                backgroundColor: [
                    chartColors.paid,
                    chartColors.unpaid,
                    chartColors.late
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ' $' + Math.round(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    border: {
                        display: true
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        display: false
                    },
                    ticks: {
                        callback: function(value) {
                            return Math.round(value);
                        }
                    },
                    border: {
                        display: true
                    }
                }
            }
        }
    });

    return {
        updateCharts(bankBalance, selectedTotal, paymentData = null) {
            // Update Doughnut Chart
            const available = Math.max(0, bankBalance - selectedTotal);
            doughnutChart.data.datasets[0].data = [selectedTotal, available];
            doughnutChart.update('none'); // 'none' for smooth animation

            // Update Bar Chart if payment data is provided
            if (paymentData) {
                const paid = paymentData.paid || 0;
                const unpaid = paymentData.unpaid || 0;
                const late = paymentData.late || 0;
                
                barChart.data.datasets[0].data = [paid, unpaid, late];
                barChart.update('none');
            }
        },
        
        updateTheme() {
            // Refresh theme colors
            chartColors = getThemeColors();
            
            // Update doughnut chart colors
            doughnutChart.data.datasets[0].backgroundColor = [
                chartColors.allocated, 
                chartColors.available
            ];
            
            // Update bar chart colors
            barChart.data.datasets[0].backgroundColor = [
                chartColors.paid,
                chartColors.unpaid,
                chartColors.late
            ];
            
            // Update both charts
            doughnutChart.update('none');
            barChart.update('none');
        }
    };
}

// Global function to update charts theme (can be called from anywhere)
window.updateChartsTheme = function() {
    if (window.charts && typeof window.charts.updateTheme === 'function') {
        // Wait a bit for CSS to load after theme change
        setTimeout(() => {
            window.charts.updateTheme();
        }, 150);
    }
};

