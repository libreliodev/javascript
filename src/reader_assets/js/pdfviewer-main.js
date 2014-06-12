$(function(){
  var doc_query = querystring.parse(get_url_query(document.location+'')),
  pdf_url = doc_query ? doc_query.waurl : null,
  external_b = doc_query ? typeof doc_query.external != 'undefined' : null,
  pdf_viewer = $('.pdfviewer');
  if(pdf_url)
  {
    if(!external_b)
      pdf_url = s3bucket_file_url(pdf_url);
    PDFJS.getDocument(pdf_url, null, null, downloadProgressHandler)
      .then(function(pdf)
      {
        try {
          pdf_viewer.pdfviewer('set', 'pdfDoc', pdf);
        }catch(e) {
          console.error(e);
        }
      })
      .catch(function(err)
        {
          notifyError(err);
        });
  }
  function downloadProgressHandler(ev)
  {
    if($('.pdfviewer-progress').data('fadingout'))
      return;
    $('.pdfviewer-progress .progress-bar')
      .css('width', (ev.loaded / ev.total * 100) + '%');
    if(ev.loaded > ev.total)
      $('.pdfviewer-progress').fadeOut().data('fadingout', true);
  }
  pdf_viewer.bind('openlink', function(ev, obj)
     {
       var data = obj.data,
       url = data.url;

       // buy:// protocol
       if(url == 'buy://')
       {
         $.ajax('application_.json', {
           dataType: 'json',
           success: function(app_data)
           {
             var type = app_data.CodeService ? 'code' : 
               (app_data.UserService ? 'user' : null);
             if(!type)
               return;
             purchase_dialog_open({
               type: type,
               client: app_data.client_name,
               app: app_data.app_name, 
               service: type == 'user' ? app_data.UserService : 
                 app_data.CodeService,
               urlstring: pdf_url,
               deviceid: 'browser'
             });
           },
           error: function(xhr, err_text)
           {
             notifyError("Failed to request for page: " + err_text);
           }
         });
         obj.return_value = false;
       }
     });
  $('.next-btn').click(function()
    {
      pdf_viewer.pdfviewer('pagecurl_to', 'next');
      return false;
    });
  $('.previous-btn').click(function()
    {
      pdf_viewer.pdfviewer('pagecurl_to', 'previous');
      return false;
    });
  $('.portrait-mode-btn').click(function(){ 
    change_display_mode('portrait');
    return false;
  });
  $('.book-mode-btn').click(function(){ 
    change_display_mode('book');
    return false;
  });
  function change_display_mode(disp_mode)
  {
    var display_mode = $('.pdfviewer').pdfviewer('get', 'display_mode');
    if(display_mode != disp_mode)
      $('.pdfviewer').pdfviewer('set', 'display_mode', disp_mode);
  }

  /*var canvas = $('canvas')[0],
  img = new Image();
  img.src = 'assets/img/background.png';
  var img2 = new Image();
  img2.src = 'assets/img/logo.png';
  var mpagecurl = new PageCurl({
    canvas: canvas,
    grabbable: true,
    corner_epsilon_x: 50,
    corner_epsilon_y: 50,
    rect: [ 100, 150, $(window).width()/2-100, $(window).height()/2-100 ],
    corners: [ 'tl', 'bl', ],
    limits: [ 'tr', 'br' ],
    src0: {image: img2},
    src1: {image: img},
    src2: {image: img2},
    clear_canvas: true
  });
  setTimeout(function(){mpagecurl.render();}, 50);
  /*mpagecurl.destroy();*/
  /*$(document).on('mousemove', function(ev)
    {
      var x = ev.pageX,
      y = ev.pageY;
      var ctx = canvas.getContext('2d');
      side = 'tl',
      rect = [ 150, 150, $(window).width()/2-100, $(window).height()/2-100 ];
      try {
        if(!PageCurl.flip_page_restricted(rect, side, [x,y], ['br','tr']))
        {
          ctx.clearRect(0, 0, canvas.width, canvas.height),
          PageCurl.render_page(ctx, rect, 
                          {image:img}, {image: img}, {image:img2}, side, [x, y]);
        }
      }catch(e) { console.error(e); }
    });*/
  /*setTimeout(function(){
    var ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  var rect = [ 150, 150, $(window).width()/2-100, $(window).height()/2-100 ];
    pivot = [ rect[0] + rect[2]*2, rect[1] ];
  PageCurl.render_page(ctx, rect, 
                       {image:img}, {image: img}, {image:img2}, 'tl', pivot);
},50);*/
  
  function s3bucket_file_url(key)
  {
    return '//' + config.s3Bucket + '.s3.amazonaws.com/' + key;
  }
});
