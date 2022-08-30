//global
var market_caps = [];
var prices = [];
var total_volumes = [];
var dates_fmt = [];

//theme set
var theme = "lumen";

$(document).ready(function() {
    console.log("Page Loaded");

    // set theme
    if (theme) {
        $('head link').last().after('<link rel="stylesheet" type="text/css" href="https://stackpath.bootstrapcdn.com/bootswatch/4.5.2/' + theme + '/bootstrap.min.css">');
        $('#themeSelect').val(theme);
    } else {
        //order matters in CSS load
        $('head link').last().after('<link rel="stylesheet" type="text/css" href="https://stackpath.bootstrapcdn.com/bootswatch/4.5.2/' + $('#themeSelect').val() + '/bootstrap.min.css">');
    }

    // set datepicker
    $("#datepicker").datepicker();
    $("#datepicker").datepicker('setDate', new Date());

    // event listeners
    $('#themeSelect').change(function() {
        let styleSheets = $('head').find('link');
        styleSheets.each(function() {
            if ($(this).attr('href').includes('bootswatch')) {
                $(this).remove();
            }
        });

        // add new sheet
        $('head link').last().after('<link rel="stylesheet" type="text/css" href="https://stackpath.bootstrapcdn.com/bootswatch/4.5.2/' + $('#themeSelect').val() + '/bootstrap.min.css">');
    });

    $("#btn_guess").on("click", function() {
        makeSingleDateRequest();
        makeDateRangeRequest();
    });

    $("#plot_target").on("change", function() {
        makePlot();
    });

    // window resize, remake plot
    $(window).resize(function() {
        if ($("#range_result").css('display') != 'none') {
            makePlot();
        }
    });
});

function makeDateRangeRequest() {
    // delete old table data
    $("#table tbody").html("");
    $('#table').DataTable().clear().destroy();

    // get date range of last 7 days
    let date1 = new Date($("#datepicker").val());
    let date2 = new Date();
    let dateOffset = (24 * 60 * 60 * 1000) * 7; //7 days
    date2.setTime(date1.getTime() - dateOffset);

    // convert to unix
    date1 = Math.floor(date1.getTime() / 1000);
    date2 = Math.floor(date2.getTime() / 1000);

    let curr = $("#currency").val();

    // build API url
    let url_range = `https://api.coingecko.com/api/v3/coins/banano/market_chart/range?vs_currency=${curr}&from=${date2}&to=${date1}`;
    console.log(url_range)
    $.ajax({
        type: "GET",
        url: url_range,
        contentType: "application/json; charset=utf-8",
        success: function(data) {
            console.log(data);

            // format UNIX dates back to human readable
            dates_fmt = [];
            data.market_caps.forEach(function(inp) {
                let d = new Date(inp[0]);
                let year = d.getUTCFullYear();
                let month = d.getUTCMonth() + 1;
                let day = d.getUTCDate();
                let hours = d.getHours();
                let minutes = "0" + d.getMinutes();
                let seconds = "0" + d.getSeconds();

                let formattedTime = hours + ':' + minutes + ':' + seconds;
                let dateString = month + "/" + day + "/" + year + " " + formattedTime;
                dates_fmt.push(dateString);
            });

            // extract other data
            market_caps = data.market_caps.map(x => x[1]);
            prices = data.prices.map(x => x[1]);
            total_volumes = data.total_volumes.map(x => x[1]);

            // init html string
            let html = "";

            // rebuild table
            for (let i = 0; i < dates_fmt.length; i++) {
                let row = `<tr>`;
                row += `<td>${dates_fmt[i]}</td>`;
                row += `<td>${prices[i].toFixed(5)}</td>`;
                row += `<td>${market_caps[i].toFixed(0)}</td>`;
                row += `<td>${total_volumes[i].toFixed(0)}</td>`;
                row += `</tr>`;

                html += row;
            }

            // remake data table
            $("#table tbody").append(html);
            $(".bar_hide").show();
            $("#range_results").show();
            $('#table').DataTable({
                order: [
                    [0, "asc"],
                ],
                dom: "<'row'<'col-sm-12 col-md-6'B><'col-sm-12 col-md-3'l><'col-sm-12 col-md-3'f>>" +
                    "<'row'<'col-sm-12'tr>>" +
                    "<'row'<'col-sm-12 col-md-12'ip>>",
                pageLength: 10,
                lengthMenu: [10, 20, 50, 100],
                buttons: [
                    { extend: 'copyHtml5' },
                    { extend: 'excelHtml5' },
                    { extend: 'csvHtml5' },
                    {
                        extend: 'pdfHtml5',
                        title: function() { return "Banano Data"; },
                        orientation: 'portrait',
                        pageSize: 'A3',
                        text: 'PDF',
                        titleAttr: 'PDF'
                    }
                ]
            });

            // make plot
            makePlot();
        },
        error: function(textStatus, errorThrown) {
            console.log("FAILED to get data");
            console.log(textStatus);
            console.log(errorThrown);
        }
    });
}

function makePlot() {
    // set target of plot
    let curr = $("#currency").val();
    let y = [];
    let inp = $("#plot_target").val();
    let title = inp;

    if (inp === "Market Cap") {
        y = market_caps;
    } else if (inp === "Total Volume") {
        y = total_volumes;
    } else {
        y = prices;
        title += ` (${curr.toUpperCase()})`
    }

    // make plot
    let trace1 = {
        x: dates_fmt,
        y: y,
        mode: 'lines+markers'
    };

    let plot_data = [trace1];
    let layout = {
        title: `${inp} of Banano - Week Leading up to ${$("#datepicker").val()}`,
        xaxis: { autotick: false, dtick: 20 },
        yaxis: { title: title }
    };

    Plotly.newPlot('plot', plot_data, layout);
}

function makeSingleDateRequest() {

    let date = $("#datepicker").val().split("/");
    date = date[1] + "-" + date[0] + "-" + date[2];
    let url = `https://api.coingecko.com/api/v3/coins/banano/history?date=${date}`;

    $.ajax({
        type: "GET",
        url: url,
        contentType: "application/json; charset=utf-8",
        success: function(data) {
            console.log(data);

            let curr = $("#currency").val();
            let actual = data.market_data.current_price[curr];
            let guess = $("#priceGuess").val();
            let diff = guess - actual;
            let perc = diff / actual * 100;
            let miss_desc = "";

            if (diff > 0) {
                miss_desc = `You overshot the actual price by ${diff.toFixed(5)} cents per banano, or a miss of ${perc.toFixed(1)}%!`;
            } else {
                miss_desc = `You undershot the actual price by ${diff.toFixed(5)} cents per banano, or a miss of ${perc.toFixed(1)}%!`;
            }

            $("#date_text").text($("#datepicker").val());
            $("#actual_price").text(actual.toFixed(5));
            $("#miss_desc").text(miss_desc);

            $(".bar_hide").show();
            $("#results").show();
        },
        error: function(textStatus, errorThrown) {
            console.log("FAILED to get data");
            console.log(textStatus);
            console.log(errorThrown);
        }
    });

}