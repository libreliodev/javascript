(function(window){
var app_name = storage.getItem(config.storageAppNameKey),
app_dir = get_app_dir(app_name),
doc_query = querystring.parse(get_url_query(document.location+'')),
pdf_url = doc_query ? doc_query.waurl : null, s3_key,
external_b = doc_query ? typeof doc_query.external != 'undefined' : null,
pdf_url_dir, annots_key, update_header_fn;


$(function(){
  var pdf_viewer = $('.pdfviewer');

  var $page_height_els = $('.pdfviewer-wrapper,.annot-edit-sidebar'),
  $page_width_els = $('.pdfviewer-wrapper .page-selector');
  $(window).on('resize', page_size_els_resize);
  function page_size_els_resize()
  {
    $page_height_els.css('height', $(window).height() - 35);
    $page_width_els.css('width', $(window).width() - 200);
  }

  if(pdf_url)
  {
    setTimeout(function()
      {
        annots_key = path.dirname(pdf_url) + '/' + 
          path.basename(pdf_url, path.extname(pdf_url)) + '_updates.plist';
        var saved_data = localStorage.getItem(annots_key);
        if(saved_data)
        {
          try {
            var obj = $.plist($.parseXML(saved_data));
            annotations = pdfreader_parse_annotations_update(obj);
            for(var pid in annotations)
            {
              var annots = annotations[pid];
              for(var c = 0; c < annots.length; ++c)
              {
                var annot = annots[c];
                annot.page_index = parseInt(pid.substr(1));
                annotation_init(annot);
              }
            }
          } catch(e) {
            console.log(e);
            annotations = {};
          }
        }

        if(external_b)
        {
          pdf_url_dir = url_dir(pdf_url);
          load_doc();
        }
        else
        {
          s3_key = pdf_url;
          awsS3.getSignedUrl('getObject', {
            Bucket: config.s3Bucket,
            Key: pdf_url ,
            Expires: awsExpireReverse(config.awsExpireReverseInHours)
          }, function(err, url_str)
             {
               if(err)
                 return notifyUserError(err);
               pdf_url = url_str;
               pdf_url_dir = url_dir(pdf_url);
               load_doc();
             });
        }
      });
  }
  else
  {
    $('.pdfviewer-wrapper,.annot-edit-sidebar').hide();
  }
  
  function load_doc()
  {
    PDFJS.disableRange = false;
    page_size_els_resize();
    pdf_viewer.trigger('sizechanged');
    pdf_viewer.on('headersReceived', function(ev, data)
      {
        update_header_fn = data.headers['x-amz-meta-update'];
        pdf_viewer.off('headersReceived', arguments.callee);
      });
    pdf_viewer.pdfviewer('set', 'disable_fade_loadingscreen', true);

    var step0_done = false;
    pdf_viewer.bind('linksUpdated', function()
      {
        pdf_viewer.unbind('linksUpdated', arguments.callee);
        if(step0_done)
          continue_job();
        else
          step0_done = true;
      });
    pdf_viewer.pdfviewer('loadDocument', pdf_url, function(err)
      {
        if(err)
          return notifyUserError(err);
        annotations_init(pdf_viewer.pdfviewer('get', 'pdfDoc'), function()
          {
            if(step0_done)
              continue_job();
            else
              step0_done = true;
          });
      });
    function continue_job()
    {
      var pages = pdf_viewer.pdfviewer('get', 'curPages');
      if(pages)
        annotations_render_page();
      pdf_viewer.bind('render', annotations_render_page);
      $elements_has_target_to($('.pdfviewer-loadingscreen'), self[0])
        .fadeOut();
    }
  }
  pdf_viewer.pdfviewer('set', 'display_links', false);
  pdf_viewer.bind('new-link', function(ev, data, page)
     {
       if(data.url)
       {
         data.protocol = url('protocol', data.url);
         data.real_url = data.url;
         data.url = librelio_pdf_resolve_url(data.url, pdf_url_dir);
       }
     });


  // File menu callbacks
  $('#open-btn').click(function()
    {
      openPublicationDialog({
        app_dir: app_dir,
        extension: '.pdf'
      }, function(err, res)
         {
           if(err)
             return notifyUserError(err);
           if(res)
             document.location = 'pdf-annotation-editor.html?waurl=' + res.key;
         });
      return false;
    });
  $('#save-btn').click(function()
    {
      if(!s3_key)
        return;
      var progdlg = openProgressModal({ title: 'Saving' });
      s3PutObject(annots_key, annotationsToPlistString(), 
                  function(err, res)
        {
          if(err)
            return notifyUserError(err);
          if(update_header_fn == annots_key)
          {
            closeProgressModel(progdlg);
            localStorage.setItem(annots_key, '');
            return;
          }
          s3ModifyObjectMetadata(awsS3, {
            Bucket: config.s3Bucket,
            Key: s3_key,
            Metadata: {
              update: annots_key
            }
          }, function(err, res)
             {
               closeProgressModel(progdlg);
               if(err)
                 return notifyUserError(err);
               localStorage.setItem(annots_key, '');
             });
        });
    });
  $('#preview-btn').click(function()
    {
      var enabled = this._enabled = !this._enabled;
      $(this).toggleClass('btn-default', !enabled)
        .toggleClass('btn-success', enabled);
      pdf_viewer.unbind('curPages-changed', extend_curPages)
        .unbind('pagecurl-curPages-changed', extend_curPages)
        .unbind('openlink', open_internal_link)
        .unbind('render', annotations_render_page);
      if(enabled)
      {
        pdf_viewer.bind('curPages-changed', extend_curPages)
          .bind('pagecurl-curPages-changed', extend_curPages)
          .bind('openlink', open_internal_link);
        annotation_select(null);
      }
      else
      {
        pdf_viewer.bind('render', annotations_render_page);
      }
      pdf_viewer.pdfviewer('set', 'display_links', enabled)
        .pdfviewer('update');
    });
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
          var annot = annots[c],
          inserted = false;
          annot.element = null;
          annot.url = annot.url || '';
          for(var z = 0; z < page.extra_links.length; ++z)
          {
            var elink = page.extra_links[z];
            if(elink.id == annot.id)
            {
              page.extra_links[z] = annot;
              inserted = true;
              break;
            }
          }
          if(!inserted)
            page.extra_links.push(annot);
        }
      }
    }
  }
  function open_internal_link(ev, obj, page)
  {
    var data = obj.data;
    
    if(data.linktype == 'page' && obj.return_value !== false)
    {
      var page_num = parseInt(data.dest);
      if(page_num > 0 && page_num <= pdfdoc.numPages)
        pdf_viewer.pdfviewer('openPage', page_num);
      obj.return_value = false;
    }
  }
  function annotationsToPlistString()
  {
    function hasChanged(annot)
    {
      // for links only
      var pdf_data = annot.pdf_data;
      if(pdf_data)
      {
        return annot.remove || annot.rect[0] != pdf_data.rect[0] ||
          annot.rect[1] != pdf_data.rect[1] ||
          annot.rect[2] != pdf_data.rect[2] ||
          annot.rect[3] != pdf_data.rect[3] ||
          (annot.linktype == 'page' ? annot.dest != annot.dest_bk :
           annot.url != pdf_data.url);
      }
      return true;
    }
    var res = {};
    for(var pid in annotations)
    {
      var annots = annotations[pid],
      pres = [];
      for(var c = 0; c < annots.length; ++c)
      {
        var annot = annots[c];
        if(!hasChanged(annot))
          continue;
        var annot_data = {
          Action: annot.remove ? 'Remove' : 'Add'
        };
        if(annot.id)
          annot_data.ID = annot.id;
        if(annot.remove)
          continue;
        annot_data.Rect = annot.rect.join(' ');
        switch(annot.subtype)
        {
        case 'Link':
          switch(annot.linktype)
          {
          case 'page':
            annot_data.Link = 'goto://' + annot.dest;
            break;
          case 'url':
            annot_data.Link = annot.url;
            break;
          }
          break;
        }
        pres.push(annot_data);
      }
      if(pres.length > 0)
        res[pid] = pres;
    }
    return $.plist('toString', res);
  }
  function saveAnnotationsInLocalStorage()
  {
    localStorage.setItem(annots_key, annotationsToPlistString());
  }
  var annots_changed_timeout,
  annots_save_every = 1000;
  function annotationsHasChanged()
  {
    if(annots_changed_timeout !== undefined)
      clearTimeout(annots_changed_timeout);
    annots_changed_timeout = setTimeout(function()
      {
        saveAnnotationsInLocalStorage();
        annots_changed_timeout = undefined;
      }, annots_save_every);
  }
  function s3PutObject(key, body, cb)
  {
    awsS3.putObject({
      Bucket: config.s3Bucket,
      Key: key,
      Body: body
    }, cb);
  }
  function openProgressModal(opts, cb)
  {
    var obj = { message: ' ' };
    if(cb)
      obj.buttons = {
        cancel: {
          label: "Cancel",
          className: "btn-default",
          callback: cb
        }
      };
    return bootbox.dialog($.extend(obj, opts));
  }
  function closeProgressModel(modal)
  {
    modal.on('hidden.bs.modal', function()
      {
        modal.off('hidden.bs.modal', arguments.callee);
        modal.remove();
      });
    modal.modal('hide');
  }
  // Annotation Editor
  var annotations = [], // list of pages where include list of annotaions in it
  included_pages = [],
  selected_annot,
  pdfdoc_dests,
  pdfdoc;
  function annotations_init(doc, cb)
  {
    for(var i = 0; i < doc.numPages; ++i)
      annotations['p' + (i + 1)] = annotations['p' + (i + 1)] || [];
    included_pages = [];
    pdfdoc = doc;
    var jobs = [];

    jobs.push(function(next)
      {
        doc.getDestinations().then(function(res)
          {
            pdfdoc_dests = res;
            next();
          });
      });

    async.series(jobs, cb);
  }
  /*
  function annotations_as_json_string()
  {
    function addAnnots(annots)
    {
      var ret = [];
      if(annots)
        for(var i = 0, l = annots.length; i < l; ++i)
        {
          var data = annots[i],
          annot = {
            subtype: data.subtype,
            rect: data.rect
          };
          if(data.id)
          {
            annot.id = data.id;
            if(data.remove)
            {
              annot.remove = data.remove;
              ret.push(annot);
              continue;
            }
          }
          switch(data.subtype)
          {
          case 'Link':
            annot.linktype = data.linktype;
            annot.value = data.value;
            ret.push(annot);
            break;
          }
        }
      return ret;
    } 
    var ret = [];
    for(var i = 0, l = pdfdoc.numPages; i < l; ++i)
      ret.push(addAnnots(annotations[i]));
    return JSON.stringify(ret);
  }
  */
  function annotations_render_page()
  {
    function add_annots_of_page(page)
    {
      series.push(function(next)
        {
          annotations_add_page_annots(page)
            .then(function()
              {
                included_pages.push(page.index);
                next();
              });
        });
    }
    var pages = pdf_viewer.pdfviewer('get', 'curPages'),
    links_div = pdf_viewer.pdfviewer('get', 'links_div'),
    series = [],
    $links_div = $(links_div);
    for(var i = 0, l = pages.length; i < l; ++i)
    {
      var page = pages[i],
      docPage = page.docPage;
      if(docPage && included_pages.indexOf(page.index) == -1)
        add_annots_of_page(page)
    }
    async.series(series, function()
      {
        for(var i = 0, l = pages.length; i < l; ++i)
        {
          var page = pages[i],
          docPage = page.docPage,
          annots = annotations['p' + page.index];
          if(docPage && annots)
          {
            for(var c = 0, cl = annots.length; c < cl; ++c)
            {
              var annot = annots[c];
              if(annot.remove)
                continue;
              if(annot.subtype == 'Link')
                $links_div.append(
                  annot.element = annot_editor_link_create(annot, page));
            }
          }
        }
      });
  }
  function getAnnotsById(id, annots)
  {
    for(var i = 0, l = annots.length; i < l; ++i)
      if(annots[i].id == id)
        return annots[i];
  }
  function annotations_add_page_annots(page)
  {
    function add_annot(cdata)
    {
      cdata.page_index = page.index;
      annotation_init(cdata);
      mannots.push(cdata);
    }
    var mannots = annotations['p' + page.index],
    docPage = page.docPage;
    return docPage.getAnnotations().then(function(annots)
      {
        if(page.extra_links)
        {
          var eannots = page.extra_links;
          for(var i = 0, l = eannots.length; i < l; ++i)
          {
            var eannot = eannots[i],
            annot = getAnnotsById(eannot.id, mannots);
            if(!annot)
              add_annot(eannot);
          }
        }

        for(var i = 0, l = annots.length; i < l; ++i)
        {
          var data = annots[i];
          if(data.subtype == 'Link')
          {
            var annot = getAnnotsById(data.id, mannots);
            if(!annot)
            {
              var cdata = $.extend(true, {}, data);
              cdata.pdf_data = data;
              add_annot(cdata);
            }
          }
        }
      });
  }
  function annotation_init(data)
  {
    switch(data.subtype)
    {
    case 'Link':
      data.linktype = data.linktype || (data.dest ? 'page' : 'url');
      if(data.linktype == 'page')
      {
        if(data.dest)
        {
          try {
            var dest = typeof data.dest == 'string' ? 
              pdfdoc_dests[data.dest][0] : data.dest[0];
            doc.getPageIndex(dest).then(function(index)
              {
                data.dest_bk = data.dest = index + 1;
              });
          }catch(e) {
          }
        }
      }
      else
      {
        var value = data.url||'',
        query_str = librelio_url_query(value);
        data.value_query = querystring.parse(query_str) || {};
        data.value_link = query_str.length > 0 ? 
          value.substr(0, value.length - query_str.length - 1) : value;
      }
      break;
    }
  }
  var annot_creator;
  $('#new-link-btn').click(function()
    {
      function button_state_changed(b)
      {
        $btn.toggleClass('btn-default', !b)
          .toggleClass('btn-success', b);
      }
      var b = !annot_creator || annot_creator.subtype != 'Link',
      $btn = $(this);
      if(selected_annot)
        annotation_select(null);
      if(annot_creator)
      {
        annot_creator.destroy();
        annot_creator = null;
      }
      button_state_changed(b);
      if(b)
      {
        var subtype = 'Link',
        data = {
          subtype: subtype,
          url: ''
        },
        el;
        annot_creator = new AnnotationCreator({
          pdfviewer: pdf_viewer,
          subtype: subtype,
          createElement: function(rect)
          {
            var $links_div = $(pdf_viewer.pdfviewer('get', 'links_div')),
            pages = pdf_viewer.pdfviewer('get', 'curPages'),
            page = getPageAtPoint(pages, rect);
            if(!page || !page.docPage)
              return;
            data.rect = $.fn.pdfviewer.pageRectToDocPageRect(rect, 
                                                             page.docPage, 
                                                             page.rect);
            annotation_init(data)
            var annots = annotations['p' + page.index];
            el = annot_editor_link_create(data, page);
            data.id = genRandId();
            annots.push(data);
            $links_div.append(el);
            data.element = el;
            data.page_index = page.index;
            return el;
          },
          elementDropped: function()
          {
            annot_creator.destroy();
            annot_creator = null;
            button_state_changed(false);
            annotation_select(data, el);
            annotationsHasChanged();
          }
        });
      }
    });
  var links_props = $('.link-props');
  $('.annot-edit-sidebar').bind('keydown keypress keyup', function(ev)
    {
      ev.stopPropagation();
    });
  $('#remove-link-btn').click(function()
    {
      if(selected_annot)
      {
        // remove from annotations
        if(selected_annot.pdf_data)
          selected_annot.remove = true;
        else
        {
          var annots = annotations['p' + selected_annot.page_index];
          if(annots)
          {
            var idx = annots.indexOf(selected_annot);
            if(idx != -1)
              annots.splice(idx, 1);
          }
        }
        if(selected_annot.element)
          selected_annot.element.remove();
        annotation_select(null);
        annotationsHasChanged()
      }
      return false;
    });
  links_props.find('input[name=link-type]').change(function()
    {
      if(!selected_annot)
        return;
      if(this.checked)
      {
        var ltype = selected_annot.linktype = this.value;
        links_props.find('input[name=link]').attr('type', ltype == 'page' ? 
                                                  'number' : 'text');
        if(ltype == 'page')
        {
          var pagenum = parseInt(selected_annot.dest);
          if(isNaN(pagenum) || pagenum <= 0 || pagenum > pdfdoc.numPages)
          {
            selected_annot.dest = 1;
          }
          links_props.find('input[name=link]').val(selected_annot.dest+'');
        }
        else
        {
          links_props.find('input[name=link]').val(selected_annot.url);
        }
      }
      annotationsHasChanged();
    });
  links_props.find('.link-query').each(function()
    {
      var type = this.type;
      switch(type)
      {
      case 'checkbox':
      case 'radio':
        $(this).change(function()
          {
            if(!selected_annot)
              return;
            if(!selected_annot.value_query)
            {
              this.checked = false;
              return false;
            }
            if(this.checked)
            {
              selected_annot.value_query[this.name] = this.value;
              link_annot_update(selected_annot);
            }
            else
            {
              var value = selected_annot.value_query[this.name];
              if(value == this.value)
              {
                delete selected_annot.value_query[this.name];
                link_annot_update(selected_annot);
              }
            }
            annotationsHasChanged();
          });
        break;
      case 'select-one':
      case 'text':
      default:
        $(this).bind(type == 'select-one' ? 'change' : 'input', function(e)
          {
            if(!selected_annot)
              return;
            if(!selected_annot.value_query)
              return false;
            var value = this.value;
            if(value != '')
              selected_annot.value_query[this.name] = value;
            else
              delete selected_annot.value_query[this.name];
            link_annot_update(selected_annot);
            annotationsHasChanged();
          });
        break;
      }
    });
  function link_annot_update(annot)
  {
    if(annot.linktype == 'url')
    {
      var query_str = querystring.stringify(annot.value_query)
      annot.url = annot.value_link + (query_str ? '?' + query_str : '');
    }
  }
  links_props.find('input[name=link]').bind('input', function()
    {
      if(selected_annot)
      {
        switch(selected_annot.linktype)
        {
        case 'url':
          selected_annot.value_link = this.value;
          link_annot_update(selected_annot);
          switch_url_type(selected_annot,
           $.fn.pdfviewer.is_slideshow(selected_annot.value_link) ? 'img' : '');
          break;
        case 'page':
          selected_annot.dest = parseInt(this.value);
          if(isNaN(selected_annot.dest))
            selected_annot.dest = 1;
          break;
        }
      }
      annotationsHasChanged();
    });
  function switch_url_type(data, type)
  {
    links_props.toggleClass('img-link-props', type == 'img');
    var changed;
    links_props.find('.img-prop .link-query').each(function()
      {
        if(type == 'img')
        {
          switch(this.type)
          {
          case 'checkbox':
          case 'radio':
          case 'select-one':
            $(this).trigger('change');
            break;
          case 'text':
          default:
            $(this).trigger('input');
          }
        }
        else
        {
          if(data.value_query[this.name])
          {
            delete data.value_query[this.name];
            changed = true;
          }
        }
      });
    if(changed)
      link_annot_update(data);
  }
  function annotation_select(data, $el)
  {
    var $links_div = $(pdf_viewer.pdfviewer('get', 'links_div'));
    $links_div.find('.selected').toggleClass('selected');
    if(data && $el)
      $el.toggleClass('selected', true);
    var type = data ? data.subtype : '';
    links_props[type == 'Link' ? 'show' : 'hide']();
    selected_annot = data;
    switch(type)
    {
    case 'Link':
      links_props.find('input[name=link-type]').each(function()
        {
          this.checked = this.value == data.linktype;
        });
      links_props.find('.link-query').each(function()
        {
          if(!data.value_query)
            return;
          update_input_element_with_annot(this, data);
        });
      links_props.find('input[name=link]').val(
        (data.linktype == 'page' ? data.dest : data.value_link) || '');
      if(data.linktype == 'url')
      {
        switch_url_type(data,
           $.fn.pdfviewer.is_slideshow(selected_annot.value_link) ? 'img' : '');
      }
      break;
    }
  }
  function update_input_element_with_annot(el, data)
  {
    switch(el.type)
    {
    case 'checkbox':
    case 'radio':
      el.checked = el.value == data.value_query[el.name];
      break;
    case 'select-one':
      $(el).val(data.value_query[el.name]||'');
      break;
    case 'text':
    default:
      el.value = data.value_query[el.name]||'';
    }
  }
  function annot_editor_link_create(data, page)
  {
    function set_page(npage)
    {
      page = npage;
      docPage = npage.docPage,
      prect = npage.rect;
      scale = npage.viewport.scale;
      if(!editable_annot)
      {
        rect = $.fn.pdfviewer.docPageRectToPageRect(data.rect, docPage, prect);
        if(rect[2] < 20 * scale)
          rect[2] = 20 * scale;
        if(rect[3] < 20 * scale)
          rect[3] = 20 * scale;
        editable_annot = new PDFEditableAnnotation({
          rect: rect,
          element: $el,
          min_width: 20 * scale,
          min_height: 20 * scale
        });
      }
      else
      {
        editable_annot.min_width = 20 * scale;
        editable_annot.min_height = 20 * scale;
      }
    }
    var $el = $('<div/>').toggleClass('editable-link'),
    docPage, scale, rect, prect, editable_annot;
    
    if(page)
      set_page(page);
    
    var dragged;
    $el.bind('click', function()
      {
        if(dragged)
          return false;
        var selected = $el.hasClass('selected');
        annotation_select(!selected ? data : null, $el);
        return false;
      })
      .bind('drag-end', function()
      {
        dragged = true;
        setTimeout(function(){ dragged = false; });
        var pages = pdf_viewer.pdfviewer('get', 'curPages'),
        nrect = [ 
          parseFloat($el.css('left')), parseFloat($el.css('top')),
          $el.width(), $el.height()
        ],
        cpage = getPageAtPoint(pages, nrect);
        if(cpage && (!page || cpage.index != page.index))
        {
          var pannots = annotations['p' + page.index];
          if(page)
          {
            // replace annot place
            if(pannots)
            {
              var idx = pannots.indexOf(data);
              if(idx != -1)
                pannots.splice(idx, 1);
            }
          }
          if(pannots)
            pannots.push(data);
          data.page_index = cpage.index;
          set_page(cpage);
        }
        data.rect = $.fn.pdfviewer.pageRectToDocPageRect(nrect, docPage, prect);
        annotationsHasChanged();
      });
    return $el;
  }
  function getPageAtPoint(pages, point)
  {
    for(var i = 0, l = pages.length; i < l; ++i)
    {
      var cpage = pages[i],
      cprect = cpage.rect;
      if(cpage.docPage && cprect &&
         cprect[0] < point[0] && cprect[1] < point[1] &&
         cprect[0] + cprect[2] > point[0] && 
         cprect[1] + cprect[3] > point[1])
        return cpage;
    }
  }

});


function $elements_has_target_to(els, target)
{
  var ret = [];
  for(var i = 0, l = els.length; i < l; ++i)
  {
    var el = els[0];
    if($(el.getAttribute('data-target')).index(target) != -1)
      ret.push(el);
  }
  return $(ret);
}

var randIdChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
randIdCharLen = 5;
function genRandId()
{
  var r = '';
  for(var i = 0; i < randIdCharLen; ++i)
    r += randIdChars[Math.floor(randIdChars.length * Math.random())];
  return r;
}

})(window);
(function(window, undefined){
  var creator = window.AnnotationCreator = function(opts)
  {
    function update_mask_rect()
    {
      var offset = pdfviewer.offset();
      mask.css({
        left: offset.left,
        top: offset.top,
        width: pdfviewer.width(),
        height: pdfviewer.height()
      });
   }
    var self = this;
    $.extend(self, opts);
    var pdfviewer = self.pdfviewer,
    links_div = pdfviewer.pdfviewer('get', 'links_div'),
    mask = self._mask = $('<div/>').css({
      position: 'fixed',
      zIndex: 3
    }),
    releaser = self._releaser = [],
    releaser2 = self._releaser2 = [],
    el;

    pdfviewer.append(mask);
    update_mask_rect();
    on($(window), releaser, 'resize', update_mask_rect)
    mask.bind('mousedown', function(ev)
      {
        var offset = pdfviewer.offset(),
        eloff = [ ev.pageX - offset.left, ev.pageY - offset.top, 0, 0 ];
        el = null;
        on($(window), releaser2, 'mouseup', mouseup_handler);
        on(mask, releaser2, 'mousemove', function(ev)
          {
            if(!el)
            {
              el = self.createElement(eloff);
              if(!el)
              {
                mouseup_handler();
                return;
              }
            }
            else
            {
              var w = ev.pageX - offset.left - eloff[0],
              h = ev.pageY - offset.top - eloff[1];
              if(w > 0)
                el.width(w);
              if(h > 0)
                el.height(h);
              el.trigger('size-changed');
            }
            el.trigger('drag-end');
          });
        return false;
      })
      .bind('mouseup', mouseup_handler);
    function mouseup_handler()
    {
      if(el)
        self.elementDropped && self.elementDropped();
      funcListCall(releaser2);
      releaser2 = self.releaser2 = [];
      return false;
    }
  }
  var p = creator.prototype;
  p.destroy = function()
  {
    funcListCall(this._releaser);
    funcListCall(this._releaser2);
    this._mask.remove();
  }
  
})(window);

(function(window, undefined){
var editablelink = function(opts)
{
  var self = this;
  $.extend(self, opts);
  var rect = self.rect,
  el = self.element;
  el.css({
    display: 'block',
    position: 'absolute',
    left: rect[0],
    top: rect[1],
    width: rect[2],
    height: rect[3]
  });
  simple_dnd(el);
  el.bind('size-changed', function()
    {
      var nw = el.width(),
      nh = el.height();
      
      if(self.max_width !== undefined && nw > self.max_width)
        el.width(self.max_width);
      else if(self.min_width !== undefined && nw < self.min_width)
        el.width(self.min_width);
      
      if(self.max_height !== undefined && nh > self.max_height)
        el.height(self.max_height)
      else if(self.min_height !== undefined && nh < self.min_height)
        el.height(self.min_height);
    })
    .append(createResizeHandle('tl', opts))
    .append(createResizeHandle('tr', opts))
    .append(createResizeHandle('br', opts))
    .append(createResizeHandle('bl', opts));
},
p = editablelink.prototype;
function createResizeHandle(corner, opts)
{
  var el = $('<div/>').addClass('resize-handle')
    .addClass('resize-handle-' + corner),
  pos, size;
  simple_dnd(el);
  el.bind('drag-start', function()
    {
      var $parent = el.parent();
      pos = [parseFloat($parent.css('left')), parseFloat($parent.css('top'))];
      size = [$parent.width(), $parent.height()];
    })
    .bind('before-drag', function(ev, ev2)
    {
      var $parent = el.parent(), 
      x, y;
      switch(corner)
      {
      case 'tl':
        x = -1;
        y = -1;
        break;
      case 'tr':
        x = 1;
        y = -1;
        break;
      case 'br':
        x = 1;
        y = 1;
        break;
      case 'bl':
        x = -1;
        y = 1;
        break;
      }
      ev2.stop();
      $parent.css({
        left: pos[0] - (x == 1 ? 0 : ev2.diffX * x),
        top: pos[1]  - (y == 1 ? 0 : ev2.diffY * y),
        width: size[0] + ev2.diffX * x,
        height: size[1] + ev2.diffY * y
      });
      $parent.trigger('size-changed');
    });
  return el;
}
function simple_dnd(el)
{
  var mousedown_ev, pos, drag_start;
  el.bind('mousedown', function(ev)
    {
      pos = [ parseFloat(el.css('left'))||0, parseFloat(el.css('top'))||0 ];
      mousedown_ev = ev;
      $(window).bind('mousemove', mousemove_handler)
        .bind('mouseup', drag_end);
      return false;
    })
    .bind('mouseup', drag_end);
  function drag_end()
  {
    mousedown_ev = null;
    if(drag_start)
    {
      drag_start = null;
      el.trigger('drag-end');
      return false;
    }
  }
  function mousemove_handler(ev)
  {
    var md_ev = mousedown_ev;
    if(md_ev)
    {
      var obj = {
        diffX: ev.pageX - md_ev.pageX,
        diffY: ev.pageY - md_ev.pageY,
        stop: function() { stop = true },
      },
      stop;
      if(!drag_start)
      {
        el.trigger('drag-start', obj);
        drag_start = true;
      }
      el.trigger('before-drag', obj);
      if(stop)
        return;
      el.css({
        left: pos[0] + obj.diffX,
        top: pos[1] + obj.diffY
      });
      el.trigger('drag', obj);
      return false;
    }
  }
}

window.PDFEditableAnnotation = editablelink;
})(window);
