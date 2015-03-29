$(function()
{
  var pdf_viewer = $('.pdfviewer');
  pdf_viewer.on('headersReceived', function(ev, data)
    {
      var update_fn = data.headers['x-amz-meta-update'];
      pdf_viewer.off('headersReceived', arguments.callee);
      if(typeof update_fn == 'string' && update_fn.length > 0)
      {
        var pdf_url = pdf_viewer.pdfviewer('get', 'pdf_url');
        if(!pdf_url)
          return;
        var pdf_url_dir = url_dir(pdf_url);
        $.ajax(pdf_url_dir + '/' + update_fn, {
          success: function(data)
          {
            try {
              var obj = $.plist($.parseXML(data));
              obj = pdfreader_parse_annotations_update(obj);
            } catch(e) {
              console.log("Couldn't parse annotations update file: " + e);
            } finally {
              update_annots(obj);
            }
            pdf_viewer.trigger('linksUpdated', [ obj ]);
          },
          error: function(xhr, err, err_text)
          {
            console.log("Couldn't load annotations update file: " + 
                        update_fn + ' error: ' + err_text);
            pdf_viewer.trigger('linksUpdated');
          }
        });
      }
      else
      {
        pdf_viewer.trigger('linksUpdated');
      }
    });
  function update_annots(annotations)
  {
    var pages = pdf_viewer.pdfviewer('get', 'curPages');
    if(pages)
      extend_curPages(null, pages);
    pdf_viewer.bind('curPages-changed', extend_curPages)
      .bind('pagecurl-curPages-changed', extend_curPages)
      .bind('openlink', open_internal_link);
    function extend_curPages(ev, curPages)
    {
      for(var i = 0, l = curPages.length; i < l; ++i)
      {
        var page = curPages[i],
        annots = annotations['p' + page.index];
        if(annots)
        {
          for(var c = 0, cl = annots.length; c < cl; ++c)
          {
            var annot = annots[c];
            annot.element = null;
            annot.url = annot.url || '';
          }
          page.extra_links = (page.extra_links||[]).concat(annots);
        }
      }
    }
    function open_internal_link(ev, obj, page)
    {
      var data = obj.data;
      
      if(data.linktype == 'page' && obj.return_value !== false)
      {
        var page_num = parseInt(data.dest),
        pdfdoc = pdf_viewer.pdfviewer('get', 'pdfDoc');
        if(page_num > 0 && page_num <= pdfdoc.numPages)
          pdf_viewer.pdfviewer('openPage', page_num);
        obj.return_value = false;
      }
    }
  }
  
});
function pdfreader_parse_annotations_update(obj)
{
  for(var pid in obj)
  {
    var annots_data = obj[pid],
    annots = [];
    obj[pid] = annots;
    for(var i = 0; i < annots_data.length; ++i)
    {
      var data = annots_data[i],
      annot = {
        id: data.ID,
        subtype: 'Link',
        rect: (data.Rect||'').split(' ').map(parseFloat),
        remove: data.Action == 'Remove',
        add: data.Action == 'Add'
      };
      if(typeof data.IndexAtPage == 'number')
        annot.IndexAtPage = data.IndexAtPage;
      annots.push(annot);
      switch(annot.subtype)
      {
      case 'Link':
        annot.linktype = url_protocol(data.Link+'') == 'goto:' ? 'page' : 'url';
        switch(annot.linktype)
        {
        case 'url':
          annot.url = data.Link;
          break;
        case 'page':
          annot.dest = parseInt(data.Link.substr(('goto://').length));
          break;
        }
        break;
      }
    }
  }
  return obj;
}
