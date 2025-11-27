// Javascript for the NGI Stockholm Internal Dashboard
var plot_height = 415;
var num_months = 6;
var start_date = moment(data['date_rendered']).subtract(num_months, 'months').format('YYYY-MM');

$(function () {

    try {


        // Reload the page every 30 minutes
        var reloadDelay = 1000*60*30;
        setTimeout(function(){ location.reload(); }, reloadDelay );
        console.log("Reloading page in "+Math.floor(reloadDelay / 1000 / 60)+" minutes");

        // Check that the returned data is ok
        if ('error_status' in data){
            $('.mainrow').html('<div class="alert alert-danger text-center" style="margin: 100px 50px;"><p><strong>Error loading dashboard data (API)</strong><br>'+data['page_title']+': '+data['error_status']+' ('+data['error_reason']+')</p></div><pre style="margin: 100px 50px;"><code>'+data['error_exception']+'</code></pre>');
            console.log(data['error_reason']);
            console.log(data['error_status']);
            console.log(data['page_title']);
            console.log(data['error_exception']);
            // Try reloading in a few minutes
            setTimeout(function(){ location.reload(); }, 60000); // 1 minute
            return false;
        }

        // Projects plot
        // Get library prep projects the last num_months, subtract open library prep projects
        var ydata = collect_n_months(data['num_projects'], num_months, start_date);
        ydata = Object.keys(ydata).concat(Object.keys(data['open_projects'])).reduce(function(obj, k) {
          obj[k] = (ydata[k] || 0) - (data['open_projects'][k] || 0);
          return obj;
        }, {})
        // Get sequencing projects the last num_months, subtract open sequencing projects
        var ydata_seq = collect_n_months(data['num_seq_projects'], num_months, start_date);
        ydata_seq = Object.keys(ydata_seq).concat(Object.keys(data['open_seq_projects'])).reduce(function(obj, k) {
          obj[k] = (ydata_seq[k] || 0) - (data['open_seq_projects'][k] || 0);
          return obj;
        }, {})
        // Add open sequencing projects to open library prep projects
        var open = Object.keys(data['open_projects']).concat(Object.keys(data['open_seq_projects'])).reduce(function(obj, k) {
          obj[k] = (data['open_projects'][k] || 0) + (data['open_seq_projects'][k] || 0);
          return obj;
        }, {})
        // Sum projects count
        var open_projs = Object.keys(open).map(function(a){return open[a]}).reduce(function(a,b){return a+b});
        var all_projs = Object.keys(ydata).map(function(a){return ydata[a]}).reduce(function(a,b){return a+b}) +
             Object.keys(ydata_seq).map(function(a){return ydata_seq[a]}).reduce(function(a,b){return a+b});
        var subtitle = all_projs+' since '+start_date+', '+open_projs+' currently open';
        make_bar_chart_js('#num_projects_plot', '# Projects', subtitle, {'Library prep': ydata, 'Sequencing only': ydata_seq, 'Ongoing': open});

        // Samples plot
        var ydata = collect_n_months(data['num_samples'], num_months, start_date);
        var ydata_seq = collect_n_months(data['num_seq_samples'], num_months, start_date);
        var all_samples = Object.keys(ydata).map(function(a){return ydata[a]}).reduce(function(a,b){return a+b}) +
             Object.keys(ydata_seq).map(function(a){return ydata_seq[a]}).reduce(function(a,b){return a+b});
        var subtitle = all_samples+' since '+start_date;
        make_bar_chart_js('#num_samples_plot', '# Samples', subtitle, {'Library prep': ydata, 'Sequencing only': ydata_seq});


        // Delivery times plot
        make_delivery_times_plot();

        // Finished Library turn-around-time plot
        make_finished_lib_median_plot();

        // Affiliations plot
        make_affiliations_plot();

        // Throughput plot
        make_throughput_plot();

    } catch(err){
        $('.mainrow').html('<div class="alert alert-danger text-center" style="margin: 100px 50px;"><p><strong>Error loading dashboard data</strong></p></div><pre style="margin: 100px 50px;"><code>'+err+'</code></pre>');
        console.log(err);
        // Try reloading in a few minutes
        setTimeout(function(){ location.reload(); }, 60000); // 1 minute
    }

});

function collect_n_months(data, n, start_key) {
    var months = Object.keys(data).sort().reverse();
    var ndata = Object();
    for (i=0; i<n; i++) {
        var month = months[i];
        var mkeys = Object.keys(data[months[i]]);
        for (j=0; j<mkeys.length; j++) {
            var mdata = data[months[i]][mkeys[j]];
            if (ndata.hasOwnProperty(mkeys[j])) {
                ndata[mkeys[j]] += mdata;
            }
            else {
                ndata[mkeys[j]] = mdata;
            }
        }
        if (typeof start_key !== 'undefined' && month == start_key) {
            break;
        }

    }
    return ndata;
}



function make_delivery_times_plot(){
    // Gather delivery time data
    var ydata = collect_n_months(data['delivery_times'], num_months, start_date);
    var labels = Object.keys(ydata).sort(function(a,b){
        return a.match(/\d+/) - b.match(/\d+/);
    });
    var values = labels.map(function(l){ return ydata[l]; });

    // Compute median value (in weeks)
    function computeMedian(arr){
        var sorted = arr.slice().sort(function(a,b){return a-b;});
        var half = Math.floor(sorted.length/2);
        if (sorted.length % 2)
            return sorted[half];
        return (sorted[half-1] + sorted[half]) / 2.0;
    }
    var median = computeMedian(values);

    // Calculate total for percentages
    var total = values.reduce(function(a, b) { return a + b; }, 0);

    // Prepare container
    var $container = $('#delivery_times_plot');
    $container.empty(); // remove any previous content

    // Create canvas element for Chart.js
    var $canvas = $('<canvas></canvas>');
    $container.append($canvas);
    var ctx = $canvas[0].getContext('2d');
    // Ensure the canvas has height for visibility subtract space for Finished Lib TaT
    $canvas.attr('height', plot_height-200);
    $container.css('height', plot_height-200 + 'px');

    // Chart.js doughnut configuration
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    '#377eb8','#4daf4a','#984ea3','#ff7f00',
                    '#a65628','#f781bf','#999999','#e41a1c'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            circumference: 180,
            rotation: -90,
            plugins: {
                title: {
                    display: true,
                    text: 'Delivery Times',
                    font: { size: 18 }
                },
                legend: {
                    display: true,
                    position: 'right'
                },
                tooltip: {
                    callbacks: {
                        label: function(context){
                            var label = context.label || '';
                            var val = context.parsed;
                            var percentage = ((val / total) * 100).toFixed(1);
                            return label + ': ' + val + ' projects (' + percentage + '%)';
                        }
                    }
                }
            }
        }
    });
}
  
// Chart.js stacked bar chart for # Projects and # Samples
function make_bar_chart_js(target, title, subtitle, seriesData){
    // Determine all categories (union of keys across series)
    var categoriesSet = {};
    var categoryTotals = {};
    Object.keys(seriesData).forEach(function(series){
        Object.keys(seriesData[series]).forEach(function(cat){
            categoriesSet[cat] = true;
            if (!categoryTotals[cat]) {
                categoryTotals[cat] = 0;
            }
            categoryTotals[cat] += seriesData[series][cat];
        });
    });
    var categories = Object.keys(categoriesSet).sort(function(a, b) {
        return categoryTotals[b] - categoryTotals[a];
    });

    // Colors for up to three series
    var palette = ['#315a7b', '#377eb8', '#4daf4a'];

    var datasets = Object.keys(seriesData).map(function(series, idx){
        var data = categories.map(function(cat){
            return seriesData[series][cat] !== undefined ? seriesData[series][cat] : 0;
        });
        return {
            label: series,
            data: data,
            backgroundColor: palette[idx % palette.length]
        };
    });

    var $container = $(target);
    $container.empty(); // clear previous content
    var $canvas = $('<canvas></canvas>');
    $container.append($canvas);
    var ctx = $canvas[0].getContext('2d');
    // Ensure the canvas has height for vertical bars visibility
    $canvas.attr('height', plot_height);
    $container.css('height', plot_height + 'px');

    // Create annotations for category totals
    var annotations = {};
    categories.forEach(function(cat, idx){
        var total = categoryTotals[cat];
        annotations['label' + idx] = {
            type: 'label',
            yValue: cat,
            xValue: total,
            xAdjust: 14,
            backgroundColor: 'rgba(0,0,0,0)',
            color: '#333',
            content: total.toString(),
            font: {
                size: 11,
                weight: 'bold'
            }
        };
    });

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: categories,
            datasets: datasets
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: title,
                    font: { size: 18 }
                },
                subtitle: {
                    display: true,
                    text: subtitle
                },
                legend: {
                    display: true,
                    position: 'bottom',
                },
                tooltip: {
                    callbacks: {
                        label: function(context){
                            var series = context.dataset.label || '';
                            var value = context.parsed.x;
                            return series + ': ' + value;
                        }
                    }
                },
                annotation: {
                    annotations: annotations
                }
            },
            scales: {
                x: {
                    stacked: true,
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}


function make_finished_lib_median_plot(){
    // Compute distribution of Sequencing Only delivery times over the last 5 months
    var months = Object.keys(deliverytimes_data).sort().reverse().slice(0,5).reverse();
    var distribution = [];
    for (var idx=0; idx<months.length; idx++) {
        try {
            var m = deliverytimes_data[months[idx]]['Sequencing Only'];
            for (var k in m) {
                distribution.push(m[k]);
            }
        } catch (err) { continue; }
    }
    distribution.sort(function(a,b){return a-b;});
    var median = 0;
    var n = distribution.length;
    if (n > 0) {
        var mid = Math.floor(n/2);
        median = (n % 2 === 1) ? distribution[mid] : (distribution[mid-1] + distribution[mid]) / 2;
    }

    // Compute date label for 5 months from now
    var labelDate = moment().add(5, 'months').format('YYYY-MM');
    // Chart container setup
    var container = document.getElementById('finished_lib_median_tat');
    container.innerHTML = '';
    container.style.height = '180px';
    var canvas = document.createElement('canvas');
    canvas.height = 180;
    container.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    if (window.finishedLibMedianChart) {
        window.finishedLibMedianChart.destroy();
    }

    // Create frequency data for line chart from raw distribution
    var frequencyData = {};
    distribution.forEach(function(value) {
        var key = Math.floor(value);
        frequencyData[key] = (frequencyData[key] || 0) + 1;
    });

    // Convert frequency data to chart data points
    var dataPoints = [];
    Object.keys(frequencyData).map(Number).sort(function(a,b){return a-b;}).forEach(function(key) {
        dataPoints.push({x: key, y: frequencyData[key]});
    });

    // Create a vertical line for the median
    window.finishedLibMedianChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Frequency',
                data: dataPoints,
                backgroundColor: 'rgba(232,100,83,0.4)',
                borderColor: 'rgba(232,100,83,1)',
                borderWidth: 1,
                fill: true,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Finished Lib TaT' },
                subtitle: {
                    display: true,
                    text: 'Median turn around for sequencing ready libraries (since ' + labelDate + '): ' + median.toFixed(1) + ' days'
                },
                annotation: {
                    annotations: {
                        medianLine: {
                            type: 'line',
                            xMin: median,
                            xMax: median,
                            borderColor: 'rgba(55,126,184,1)',
                            borderWidth: 2,
                            borderDash: [6, 6],
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: 'Days' },
                    beginAtZero: true,
                    grid: {
                        display: false
                    }
                },
                y: {
                    display: true,
                    title: { display: true, text: 'Frequency' },
                    beginAtZero: true
                }
            }
        }
    });
}


function make_affiliations_plot(){
    var ydata = collect_n_months(data['project_user_affiliations'], num_months, start_date);
    var ykeys = Object.keys(ydata).sort(function(a,b){return ydata[a]-ydata[b]}).reverse();
    
    // Prepare data for Chart.js
    var labels = [];
    var values = [];
    for(i=0; i<ykeys.length; i++){
        labels.push(ykeys[i]);
        values.push(ydata[ykeys[i]]);
    }

    // Chart.js implementation
    var $container = $('#affiliations_plot');
    $container.empty(); // remove any previous content
    
    // Create canvas element for Chart.js
    var $canvas = $('<canvas></canvas>');
    // Ensure the canvas has uses height for visibility
    $canvas.attr('height', plot_height);
    $container.css('height', plot_height + 'px');
    $container.append($canvas);
    var ctx = $canvas[0].getContext('2d');
    
    // Chart.js pie configuration
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    '#377eb8','#4daf4a','#984ea3','#ff7f00',
                    '#a65628','#f781bf','#999999','#e41a1c'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Project Affiliations',
                    font: { size: 18 }
                },
                subtitle: {
                    display: true,
                    text: 'Projects started since '+start_date
                },
                legend: {
                    display: true,
                    position: 'right',
                    labels: {
                        boxWidth: 10,
                        font: { size: 10 },
                        padding: 2
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            var label = context.label || '';
                            var value = context.parsed;
                            return label + ': ' + value + ' projects';
                        }
                    }
                }
            }
        }
    });
}


function make_throughput_plot(){
    var num_weeks = 12;
    var weeks = Object.keys(data['bp_seq_per_week']).sort().reverse().slice(0,num_weeks+1).reverse();
    var skeys = Array('NovaSeq 6000', 'NovaSeqXPlus', 'NextSeq 2000', 'Miseq', 'MinION', 'PromethION');
    // Collect all series types
    for(i=0; i<num_weeks; i++){
        var wkeys = Object.keys(data['bp_seq_per_week'][weeks[i]]);
        for(j=0; j<wkeys.length; j++){
            if(skeys.indexOf(wkeys[j]) == -1){
                skeys.push(wkeys[j]);
            }
        }
    }
    // Collect the data
    var sdata = Array();
    var total_count = 0;
    for(j=0; j<skeys.length; j++){
        var swdata = Array();
        var series_total = 0;
        for(i=0; i<num_weeks; i++){
            thisdata = data['bp_seq_per_week'][weeks[i]][skeys[j]];
            swdata.push(thisdata == undefined ? 0 : thisdata);
            total_count += thisdata == undefined ? 0 : thisdata;
            series_total += thisdata == undefined ? 0 : thisdata;
        }
        // Only include series with non-zero data
        if(series_total > 0){
            sdata.push({
                name: skeys[j],
                data: swdata,
                total: series_total
            });
        }
    }
    // Sort by total area (smallest to largest) so smallest appears at bottom
    sdata.sort(function(a, b) {
        return a.total - b.total;
    });
    // Subtitle text
    var bp_per_day = total_count / (num_weeks * 7);
    var minutes_per_genome = 3236336281 / (bp_per_day / (24*60));
    var subtitle_text = 'Average for past '+num_weeks+' weeks: '+parseInt(bp_per_day/1000000000)+' Gbp per day (1 Human genome equivalent every '+minutes_per_genome.toFixed(2)+' minutes)';

    // Chart.js replacement
    var labels = weeks;
    var colorPalette = [
        'rgba(49,90,123,1)',
        'rgba(77,175,122,1)',
        'rgba(152,78,163,1)',
        'rgba(255,127,14,1)',
        'rgba(55,126,184,1)',
        'rgba(228,26,28,1)',
        'rgba(166,86,40,1)',
        'rgba(247,129,191,1)',
        'rgba(153,153,153,1)'
    ];
    var datasets = sdata.map(function(ds, idx){
        // Divide data by 1 billion for Gbp display
        var gbpData = ds.data.map(function(val) { return val / 1000000000; });
        return {
            label: ds.name,
            data: gbpData,
            fill: true,
            backgroundColor: colorPalette[idx % colorPalette.length],
            borderColor: colorPalette[idx % colorPalette.length].replace('0.6','1'),
            borderWidth: 1,
            pointRadius: 0
        };
    });

    var $container = $('#throughput_plot');
    $container.empty();
    var $canvas = $('<canvas></canvas>');
    $container.append($canvas);
    var ctx = $canvas[0].getContext('2d');
    // Ensure the canvas has height for vertical bars visibility
    $canvas.attr('height', plot_height);
    $container.css('height', plot_height + 'px');

    if(window.throughputChart) {
        window.throughputChart.destroy();
    }
    window.throughputChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    x: {
                        stacked: true,
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Giga base pairs'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Sequencing Throughput',
                        font: { size: 18 }
                    },
                    subtitle: {
                        display: true,
                        text: subtitle_text,
                        padding: { bottom: 5 }
                    },
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            font: { size: 10  },
                            boxWidth: 10,
                            padding: 4
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                }
            }
        });
}



