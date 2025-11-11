// Javascript for the NGI Stockholm Internal Dashboard
var plot_height = 415;
var num_months = 6;
var start_date = moment(data['date_rendered']).subtract(num_months, 'months').format('YYYY-MM');

$(function () {

    try {

        Highcharts.setOptions({
            colors: ['#377eb8','#4daf4a','#984ea3','#ff7f00','#a65628','#f781bf','#999999','#e41a1c'],
            chart: {
                style: {
                    fontFamily:'"Roboto", "Helvetica Neue", Helvetica, Arial, sans-serif'
                }
            },
            plotOptions: { series: { animation: false } }
        });

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

        // Species plot
        //make_species_plot('#species_plot');

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

// Make a bar plot
function make_bar_plot(target, title, axisTitle, subtitle ,enableLegend, ydata){
    try {
        if(target === undefined){ throw 'Target missing'; }
        if(ydata === undefined){ throw 'Data missing'; }
        if(title === undefined){ title = null; }
        if(axisTitle === undefined){ axisTitle = null; }

        var iseries = [];
        var total_count = 0;
        var set_cats = {};

        // Do it once to get the catagories
        for (var i=0; i<Object.keys(ydata).length; i++) {
            var idata = ydata[Object.keys(ydata)[i]];
            var cats = Object.keys(idata).sort(function(a,b){return idata[a]-idata[b]}).reverse();
            for(var j=0; j<cats.length; j++){
              (set_cats[cats[j]] === undefined) ? set_cats[cats[j]]=idata[cats[j]] : set_cats[cats[j]]=set_cats[cats[j]]+idata[cats[j]];
            }
        }
        // Do it twice to get the data or w.e
        for (var i=0; i<Object.keys(ydata).length; i++) {
            var idata = ydata[Object.keys(ydata)[i]];
            var cats = Object.keys(set_cats).sort(function(a,b){return set_cats[a]-set_cats[b]}).reverse();
            var sorted_idata = [];
            for(var j=0; j<cats.length; j++){
                if (idata[cats[j]] === undefined) {idata[cats[j]] = 0;}
                sorted_idata.push(idata[cats[j]]);
                total_count += idata[cats[j]];
            }
            iseries.push({"name": Object.keys(ydata)[i], "data": sorted_idata});
        }
        var nice_cats = Object.keys(set_cats).sort(function(a,b){return set_cats[a]-set_cats[b]}).reverse();
        subtitle = subtitle;
        $(target).highcharts({
            colors: ['#315a7b', '#377eb8', '#4daf4a'],
            chart: {
                type: 'bar',
                height: plot_height,
                plotBackgroundColor: null,
            },
            title: {
                text: title,
                style: { 'font-size': '24px' }
            },
            subtitle: {
                text: subtitle,
            },
            tooltip: {
                shared: true,
                headerFormat: '',
                pointFormat: '<span style="color:{series.color}; font-weight:bold;">{series.name}</span>: {point.y}<br/>'
            },
            credits: { enabled: false },
            xAxis: {
                categories: nice_cats
            },
            yAxis: {
                min: 0,
                title: { text: axisTitle },
                stackLabels: { enabled: true }
            },
            legend: {
                reversed: true,
                floating: true,
                y: -30,
                x: 150,
                layout: 'vertical',
                enabled: enableLegend
            },
            plotOptions: {
                bar: {
                    borderWidth: 0,
                    groupPadding: 0.1,
                },
                series: {
                    stacking: 'normal'
                }
            },
            series: iseries
        });
    } catch(err) {
        $(target).addClass('coming_soon').text('coming soon');
        console.log(err);
    }
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

    // Prepare container
    var $container = $('#delivery_times_plot');
    $container.empty(); // remove any previous content

    // Create canvas element for Chart.js
    var $canvas = $('<canvas></canvas>');
    $container.append($canvas);
    var ctx = $canvas[0].getContext('2d');

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
            title: {
                display: true,
                text: 'Delivery Times',
                fontSize: 24
            },
            legend: {
                display: true,
                position: 'right'
            },
            tooltips: {
                callbacks: {
                    label: function(tooltipItem, data){
                        var label = data.labels[tooltipItem.index] || '';
                        var val = data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index];
                        return label + ': ' + val + ' projects';
                    }
                }
            },
            plugins: {
                // Plugin to display median in the centre of the doughnut
                beforeDraw: function(chart){
                    var width = chart.chart.width,
                        height = chart.chart.height,
                        ctx = chart.chart.ctx;
                    ctx.restore();
                    var fontSize = (height / 114).toFixed(2);
                    ctx.font = fontSize + "em sans-serif";
                    ctx.textBaseline = "middle";

                    var text = "Median: " + median,
                        textX = Math.round((width - ctx.measureText(text).width) / 2),
                        textY = height / 2;

                    ctx.fillText(text, textX, textY);
                    ctx.save();
                }
            }
        }
    });
}
  
// Chart.js stacked bar chart for # Projects and # Samples
function make_bar_chart_js(target, title, subtitle, seriesData){
    // Determine all categories (union of keys across series)
    var categoriesSet = {};
    Object.keys(seriesData).forEach(function(series){
        Object.keys(seriesData[series]).forEach(function(cat){
            categoriesSet[cat] = true;
        });
    });
    var categories = Object.keys(categoriesSet).sort();

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
                tooltip: {
                    callbacks: {
                        label: function(context){
                            var label = context.dataset.label || '';
                            var value = context.parsed.y;
                            return label + ': ' + value;
                        }
                    }
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
    container.style.height = '140px';
    var canvas = document.createElement('canvas');
    canvas.height = 180;
    container.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    if (window.finishedLibMedianChart) {
        window.finishedLibMedianChart.destroy();
    }

    // Data points: x = days, y = index
    var scatterData = distribution.map(function(d, i){
        return { x: d, y: i };
    });

    window.finishedLibMedianChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Finished Lib TaT',
                data: scatterData,
                showLine: true,
                fill: true,
                backgroundColor: 'rgba(232,100,83,0.4)',
                borderColor: 'rgba(232,100,83,1)',
                borderWidth: 2,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            parsing: false,
            plugins: {
                title: { display: true, text: 'Finished Lib TaT (Distribution with Days on X)' },
                subtitle: {
                    display: true,
                    text: 'Median turn around for sequencing ready libraries (since ' + labelDate + '/ 5 months from current date): ' + median.toFixed(1) + ' days'
                },
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context){
                            var day = context.raw && context.raw.x !== undefined ? context.raw.x : distribution[context.dataIndex];
                            var idx = context.dataIndex + 1;
                            return 'TaT ' + idx + ': ' + (day !== undefined ? day : 0) + ' days';
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: 'Days' },
                    beginAtZero: true
                },
                y: {
                    display: true,
                    title: { display: true, text: 'Observation' },
                    beginAtZero: true
                }
            },
            // Median line as a separate plugin
            plugins: [{
                id: 'medianLine',
                afterDraw: function(chart){
                    if (!distribution || distribution.length === 0) return;
                    var med = median;
                    var x = chart.scales.x.getPixelForValue(med);
                    var ctx2 = chart.ctx;
                    ctx2.save();
                    ctx2.strokeStyle = 'rgba(0,0,0,0.8)';
                    ctx2.lineWidth = 2;
                    ctx2.beginPath();
                    ctx2.moveTo(x, chart.chartArea.top);
                    ctx2.lineTo(x, chart.chartArea.bottom);
                    ctx2.stroke();
                    ctx2.restore();
                }
            }]
        }
    });
}


function make_affiliations_plot(){
    var ydata = collect_n_months(data['project_user_affiliations'], num_months, start_date);
    var ykeys = Object.keys(ydata).sort(function(a,b){return ydata[a]-ydata[b]}).reverse();
    var pdata = Array();
    for(i=0; i<ykeys.length; i++){
        var thiskey = ykeys[i];
        pdata.push([thiskey, ydata[ykeys[i]]]);
    }

    $('#affiliations_plot').highcharts({
        chart: {
            plotBackgroundColor: null,
            height: plot_height,
            type:'pie'
        },
        title: {
            text: 'Project Affiliations',
            style: { 'font-size': '24px' }
        },
        subtitle: {
            text: 'Projects started since '+start_date,
        },
        credits: { enabled: false },
        tooltip: {
            headerFormat: '',
            pointFormat: '<span style="color:{point.color}; font-weight:bold;">{point.name}</span>: {point.y} projects'
        },
        plotOptions: {
            pie: {
                dataLabels: { enabled: false },
                showInLegend: true,
            }
        },
        legend: {
            enabled: true,
            layout: 'vertical',
            align: 'right',
            verticalAlign: 'top',
            y: 100,
            itemStyle: {
                'font-size': '12px',
                'font-weight': 'normal'
            }
        },
        series: [{ data: pdata }]
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
        for(i=0; i<num_weeks; i++){
            thisdata = data['bp_seq_per_week'][weeks[i]][skeys[j]];
            swdata.push(thisdata == undefined ? 0 : thisdata);
            total_count += thisdata == undefined ? 0 : thisdata;
        }
        sdata.push({
            name: skeys[j],
            data: swdata
        });
    }
    // Subtitle text
    var bp_per_day = total_count / (num_weeks * 7);
    var minutes_per_genome = 3236336281 / (bp_per_day / (24*60));
    var subtitle_text = 'Average for past '+num_weeks+' weeks: '+parseInt(bp_per_day/1000000000)+' Gbp per day <br>(1 Human genome equivalent every '+minutes_per_genome.toFixed(2)+' minutes)';

    // Chart.js replacement
    var labels = weeks;
    var colorPalette = [
        'rgba(49,90,123,0.6)',
        'rgba(55,126,184,0.6)',
        'rgba(77,175,122,0.6)',
        'rgba(255,127,14,0.6)',
        'rgba(166,86,40,0.6)',
        'rgba(247,129,191,0.6)'
    ];
    var datasets = sdata.map(function(ds, idx){
        return {
            label: ds.name,
            data: ds.data,
            fill: true,
            backgroundColor: colorPalette[idx % colorPalette.length],
            borderColor: colorPalette[idx % colorPalette.length].replace('0.6','1'),
            borderWidth: 1,
            // stack for Chart.js stacking
            // @ts potential: keep compatibility with v2 by using 'stack' property if supported
            stack: 'Stack 0'
        };
    });

    var $container = $('#throughput_plot');
    $container.empty();
    var $canvas = $('<canvas></canvas>');
    $container.append($canvas);
    var ctx = $canvas[0].getContext('2d');

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
            // stacking
            scales: {
                xAxes: [{ stacked: true, ticks: { maxRotation: 0, minRotation: 0 } }],
                yAxes: [{ stacked: true, ticks: { beginAtZero: true } }]
            },
            legend: { display: true, position: 'top' },
            tooltips: { mode: 'index', intersect: false },
            // no subtitle option; we could modify title to include text
            title: {
                display: true,
                text: 'Sequencing Throughput'
            }
        }
    });
}



