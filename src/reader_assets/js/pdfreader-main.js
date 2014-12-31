var pdf_url_lquery, pdf_target_page;
initialize_reader(function(app_data, pdf_url, pdf_url_dir, 
                           external_b, doc_query) {
  if(!pdf_url)
    return;
  var pdf_viewer = $('.pdfviewer');
  pdf_url_lquery = querystring.parse(librelio_url_query(pdf_url));
  pdf_target_page = parseInt(url('#', document.location+'') || 
                             pdf_url_lquery.wapage);

  var pdf_filename = url('filename', pdf_url); // with no extension
  if(pdf_filename[pdf_filename.length - 1] == '_')
    pdf_filename = pdf_filename.substr(0, pdf_filename.length - 1);
  var cl = new CanvasLoader('canvasloader');
  cl.setColor('#ffffff');
  cl.show();
  $('.pdfviewer-loadingscreen .cover-img').attr('src', pdf_url_dir +  '/' + 
                                              pdf_filename + '.png');
  
  PDFJS.disableRange = false;
  if(!isNaN(pdf_target_page))
    pdf_viewer.pdfviewer('set', 'curPageIndex', pdf_target_page);
  pdf_viewer.pdfviewer('loadDocument', pdf_url, function(err)
    {
      if(err)
      {
        if(err.status == 403 && app_data)
        {
          var type = app_data.CodeService ? 'code' : 
            (app_data.UserService ? 'user' : null);
          var service_name = app_data.CodeService ? app_data.CodeService : 
            (app_data.UserService ? app_data.UserService : null);
          if(type)
          {
            purchase_dialog_open({
              type: type,
              client: app_data.Publisher,
              app: app_data.Application, 
              service: service_name,
              urlstring: path_without_query(doc_query.waurl),
              app_data: app_data,
              wasession: doc_query.wasession
            });
            return;
          }
        }
        return notifyError(err);
      }
      pdf_viewer.bind('render', function()
        {
          cl.hide();
          pdf_viewer.unbind('render', arguments.callee);
        });
    });
  pdf_viewer.bind('new-link', function(ev, data, page)
     {
       if(data.url)
       {
         data.protocol = url('protocol', data.url);
         data.real_url = data.url;
         data.url = librelio_pdf_resolve_url(data.url, pdf_url_dir);
       }
     })
    .bind('render-link', function(ev, data, page)
     {
       /* sharelist bind */
       var url_str = data.real_url;
       if(sharelist && sharelist.isSharelist(url_str))
       {
         var sharelist_obj = sharelist.new(url_str),
         el = sharelist_obj.element,
         rect = data.rect;
         $(el).css({
           position: 'absolute',
           overflow: 'auto',
           left: rect[0],
           top: rect[1],
           width: rect[2],
           height: rect[3]
         });
         data.element = el;
       }
     })
    .bind('openlink', function(ev, obj)
     {
       var data = obj.data,
       path_str = url('path', data.real_url);
       
       // buy:// protocol
       if(data.protocol == 'buy' && obj.return_value !== false)
       {
         if(app_data)
         {
           var type = app_data.CodeService ? 'code' : 
             (app_data.UserService ? 'user' : null);
           var service_name = app_data.CodeService ? app_data.CodeService : 
             (app_data.UserService ? app_data.UserService : null);
           if(!type)
             return;
           purchase_dialog_open({
             type: type,
             client: app_data.Publisher,
             app: app_data.Application, 
             service: service_name,
             urlstring: path_str,
             app_data: app_data,
             wasession: doc_query.wasession
           });
         }
         obj.return_value = false;
       }
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

});
