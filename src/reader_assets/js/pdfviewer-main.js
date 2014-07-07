var doc_query = querystring.parse(get_url_query(document.location+'')),
pdf_url = doc_query ? doc_query.waurl : null,
external_b = doc_query ? typeof doc_query.external != 'undefined' : null,
pdf_url_dir;
if(pdf_url)
{
  if(!external_b)
    pdf_url = s3bucket_file_url(pdf_url);
  pdf_url_dir = url_dir(pdf_url);
}

$(function(){
  var pdf_viewer = $('.pdfviewer'),
  bkg_color;
  if($('body').hasClass('dark-bkg'))
    bkg_color = '#000000';
  else
    bkg_color = '#ffffff';
  pdf_viewer.pdfviewer('set', 'background', bkg_color);
  if(pdf_url)
  {
    PDFJS.disableRange = false;
    //PDFJS.requestMethod = 'POST';
    PDFJS.getDocument(pdf_url, null, null, downloadProgressHandler)
      .then(function(pdf)
      {
        try {
          pdf_viewer.on('render', function()
            {
              $('.pdfviewer-loadingscreen').fadeOut();
              pdf_viewer.off('render', arguments.callee);
            });
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
    if(ev.loaded >= ev.total)
      $('.pdfviewer-progress').fadeOut().data('fadingout', true);
  }
  pdf_viewer.bind('render-link', function(ev, data, page)
     {
       if(data.url)
       {
         data.protocol = url('protocol', data.url);
         data.real_url = data.url;
         data.url = librelio_resolve_url(data.url, pdf_url_dir);
       }
     });
  pdf_viewer.bind('openlink', function(ev, obj)
     {
       var data = obj.data,
       path_str = url('path', data.real_url);
       
       // buy:// protocol
       if(data.protocol == 'buy')
       {
         $.ajax('application_.json', {
           dataType: 'json',
           success: function(app_data)
           {
             var type = app_data.code_service ? 'code' : 
               (app_data.user_service ? 'user' : null);
                var service_name = app_data.code_service ? app_data.code_service : 
              (app_data.user_service ? app_data.user_service : null);
             if(!type)
               return;
             
             // get file name from its key(remove prefix)
             var prefix = app_data.client_name + '/' + app_data.magazine_name;
             purchase_dialog_open({
               type: type,
               client: app_data.client_name,
               app: app_data.magazine_name, 
               service: service_name,
               urlstring: path_str
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

  // show pdfviewer left/right arrow when cursor is near it
  var arrow_near_epsilon = 100;
  show_$el(false, $('.previous-btn'));
  show_$el(false, $('.next-btn'));
  function show_$el(b, $el)
  {
    function end_action()
    {
      $(this).data('in-action', false);
    }
    if(b && !$el.data('in-action') && $el.data('visible') !== true)
      $el.data('in-action', true).data('visible', true).fadeIn(end_action);
    else if(!b && !$el.data('in-action') && $el.data('visible') !== false)
      $el.data('in-action', true).data('visible', false).fadeOut(end_action);
  }
  $(document).on('mousemove', function(ev)
    {
      var x = ev.pageX,
      w = $(window).width();

      show_$el(x <= arrow_near_epsilon, $('.previous-btn'));
      show_$el(w - x <= arrow_near_epsilon, $('.next-btn'));
      
    });

  
  // keyboard bindings left/right/top/bottom -> prev-page/next-page/zoom-in/zoom-out
  function zoom_plus(v)
  {
    var cur_zoom = pdf_viewer.pdfviewer('get', 'zoom'),
    zoom = cur_zoom + v,
    el = pdf_viewer[0],
    x = 0.5, y = 0.5;
    if(zoom > 4)
      zoom = 4;
    else if(zoom < 1)
      zoom = 1;
    
    if(cur_zoom > 1 && el)
    {
      x = (el.scrollLeft + pdf_viewer.width()/2) / el.scrollWidth;
      y = (el.scrollTop + pdf_viewer.height()/2) / el.scrollHeight;
    }

    if(cur_zoom != zoom)
      pdf_viewer.pdfviewer('zoomTo', zoom, x, y);
  }
  $(document).on('keyup', function(ev)
    {
      switch(ev.keyCode)
      {
      case 38: // up arrow
        zoom_plus(1.5);
        break;
      case 40: // down arrow
        zoom_plus(-1.5);
        break;
      case 37: // left arrow
        pdf_viewer.pdfviewer('pagecurl_to', 'previous');
        break;
      case 39: // right arrow
        pdf_viewer.pdfviewer('pagecurl_to', 'next');
        break;
      }
    });
});
