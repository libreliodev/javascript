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
  var pdf_viewer = $('.pdfviewer');
  if(pdf_url)
  {
    PDFJS.disableRange = false;
    pdf_viewer.pdfviewer('loadDocument', pdf_url, function(err)
      {
        if(err)
          notifyError(err);
      });
  }
  pdf_viewer.bind('new-link', function(ev, data, page)
     {
       if(data.url)
       {
         data.protocol = url('protocol', data.url);
         data.real_url = data.url;
         data.url = librelio_pdf_resolve_url(data.url, pdf_url_dir);
       }
     });
  pdf_viewer.bind('openlink', function(ev, obj)
     {
       var data = obj.data;
       
       // buy:// protocol
       if(data.protocol == 'buy')
       {
         var app_url = 'application_.json'
         $.ajax(app_url, {
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
             notifyError(sprintf(_("Couldn't load `%s`: %s"), app_url,
                                 textStatus));
           }
         });
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
