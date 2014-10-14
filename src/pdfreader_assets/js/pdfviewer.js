(function($, undefined){
  var arraySlice = Array.prototype.slice,
  default_opts = {
    display_mode: 'book',
    curPageIndex: 1,
    zoom: 1,
    show_selector_fac: 0.5,
    book_mode_fist_page_odd: true,
    auto_select_display_mode: true,
    auto_resizable: true,
    moveable: true,
    background: '#ffffff',
    display_links: true,
    keyboard_shortcut: true
  },
  dhtml_global = {
    screen_width: function()
    {
      return $(window).width();
    }, 
    screen_height: function()
    {
      return $(window).height();
    }, 
    canvas_width: function()
    {
      return this.width() || this.prop('width');
    },
    canvas_height: function()
    {
      return this.height() || this.prop('height');
    },
    parent_width: function()
    {
      return this.parent().width();
    },
    parent_height: function()
    {
      return this.parent().height();
    }
  };
  function newEl(a)
  {
    return document.createElement(a);
  }
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
  function copy_canvas(dest, src, dont_change_size)
  {
    var dest_ctx = dest.getContext('2d');
    if(!dont_change_size)
    {
      if(dest.width != src.width || 
         dest.height != src.height)
      {
        dest.width = src.width;
        dest.height = src.height;
      }
      dest_ctx.clearRect(0, 0, dest.width, dest.height);
      dest_ctx.drawImage(src, 0, 0);
    }
    else
    {
      dest_ctx.clearRect(0, 0, dest.width, dest.height);
      dest_ctx.drawImage(src, 0, 0, dest.width, dest.height);
    }
  }
  function get_view_scale_for_canvas(view, size, type)
  {
    var canv_w = size.width,
    canv_h = size.height,
    page_w = view[2] - view[0],
    page_h = view[3] - view[1],
    b = page_w / page_h > canv_w / canv_h,
    scale;
    switch(type)
    {
    case 'fill':
      scale = b ? canv_h/page_h : canv_w/page_w;
      break;
    default:
      scale = !b ? canv_h/page_h : canv_w/page_w;
    }
    return scale;
  }
  function pdf_viewport_for_canvas(view, size, type)
  {
    var canv_w = size.width,
    canv_h = size.height,
    page_w = view[2] - view[0],
    page_h = view[3] - view[1],
    b = page_w / page_h > canv_w / canv_h,
    scale = get_view_scale_for_canvas(view, size, type);
    var offx = (canv_w - page_w * scale) / 2,
    offy = (canv_h - page_h * scale) / 2;
    return new PDFJS.PageViewport(view, scale, 0, offx, offy);
  }
  function get_render_pages(doc, canvas, o, cb)
  {
    function getPage(i, cb)
    {
      doc.getPage(i).then(function(res) { cb(null, res); }).catch(cb);
    }
    function makeRect(pages)
    {
      switch(o.display_mode)
      {
      case 'book':
        var req_size = [ 0, 0, 0, 0 ],
        len = 0;
        $.each(pages, function(i, page)
          {
            if(page.docPage)
            {
              var view = page.docPage.view;
              page.offset = [ req_size[2], 0 ];
              req_size[2] += view[2] - view[0];
              req_size[3] = Math.max(view[3] - view[1], req_size[3]);
              len++;
            }
            page.scale = 1;
          });
        if(len == 1)
        {
          if(pages[1])
            pages[1].offset = [ req_size[2], 0 ];
          req_size[2] *= 2;
        }
        pages.view = req_size;
        break;
      case 'portrait':
        pages.view = pages[0].docPage.view;
        break;
      }
    }
    var cmds = [],
    ret = [],
    getPages = [];
    switch(o.display_mode)
    {
    case 'book':
      var fodd_effect = (o.book_mode_fist_page_odd ? 1 : 0),
      page_idx = o.curPageIndex - (o.curPageIndex % 2 === fodd_effect ? 1 : 0);
      for(var i = 0; i < 2; ++i)
        ret.push({ index: page_idx + i });
      break;
    case 'portrait':
      ret.push({
        index: o.curPageIndex,
        scale: 1,
        offset: [0, 0]
      });
      break;
    }
    $.each(ret, function(i, p)
      {
        if(p.index > 0 && p.index <= doc.numPages)
          getPages.push(p.index);
      });
    async.map(getPages, getPage, function(err, pages)
      {
        if(err)
          return cb && cb(err);
        var pidx = $.map(pages, function(p) { return p.pageNumber; });
        for(var i = 0, l = ret.length; i < l; ++i)
        {
          var page = ret[i],
          idx = pidx.indexOf(page.index);
          if(idx != -1)
            page.docPage = pages[idx];
        }
        makeRect(ret);
        cb && cb(null, ret);
      });
  }
  function selector_update_active_pages()
  {
    var self = this,
    o = self.data(pvobj_key),
    $el = self.find('.page-selector'),
    pages;
    if(o.curPages)
      pages = $.map(o.curPages, function(page) { return page.index });
    $el.find('.page-item').each(function()
      {
        var $this = $(this),
        idx = parseInt($this.data('page-num'));
        $this.toggleClass('active', pages.indexOf(idx) != -1);
      });  
  }
  function docPageRectToPageRect(rect, docPage, prect)
  {
    var view = page.view;
    rect = [
      (rect[0] - view[0]) / (view[2] - view[0]) * prect[2],
      prect[3] - (rect[3] - view[1]) / (view[3] - view[1]) * prect[3],
      (rect[2] - view[0]) / (view[2] - view[0]) * prect[2],
      prect[3] - (rect[1] - view[1]) / (view[3] - view[1]) * prect[3]
    ];
    // rect in [x y w h] format
    return [
      rect[0] + prect[0],
      rect[1] + prect[1], 
      rect[2] - rect[0],
      rect[3] - rect[1]
    ];
  }
  function docPageRectToPageRect(rect, docPage, prect)
  {
    var view = docPage.view;
    rect = [
      (rect[0] - view[0]) / (view[2] - view[0]) * prect[2],
      prect[3] - (rect[3] - view[1]) / (view[3] - view[1]) * prect[3],
      (rect[2] - view[0]) / (view[2] - view[0]) * prect[2],
      prect[3] - (rect[1] - view[1]) / (view[3] - view[1]) * prect[3]
    ];
    // rect in [x y w h] format
    return [
      rect[0] + prect[0],
      rect[1] + prect[1], 
      rect[2] - rect[0],
      rect[3] - rect[1]
    ];
  }
  function pageRectToDocPageRect(rect, docPage, prect)
  {
    rect = rect.concat();
    var view = docPage.view;
    // conv rect to [x y x2 y2] format
    rect[0] = rect[0] - prect[0];
    rect[1] = rect[1] - prect[1];
    rect[2] = rect[2] + rect[0];
    rect[3] = rect[3] + rect[1];
    var dw = view[2] - view[0],
    dh = view[3] - view[1];
    rect[0] = rect[0] / prect[2] * dw + view[0];
    rect[2] = rect[2] / prect[2] * dw + view[0];

    var tmp = rect[3];
    rect[3] = (1 - rect[1] / prect[3]) * dh + view[1];
    rect[1] = (1 - tmp / prect[3]) * dh + view[1];

    return rect;
  }
  function setupAnnotations(doc, page, prect, canvas, $annotationLayerDiv)
  {
    var canvasOffset = $(canvas).offset(),
    annotDivOffset = $annotationLayerDiv.offset(),
    self = this,
    o = self.data(pvobj_key),
    docPage = page.docPage;

    var promise = docPage.getAnnotations().then(function (annotationsData)
      {
        function createLink(data)
        {
          data = $.extend(true, {}, data);
          var rect = data.rect;
          data.rect = rect = docPageRectToPageRect(rect, docPage, prect);

          rect[0] += canvasOffset.left - annotDivOffset.left;
          rect[1] += canvasOffset.top - annotDivOffset.top;
          self.trigger('new-link', [ data, page ]);
          self.trigger('render-link', [ data, page ]);
          
          if(!data.element)
          {
            var click_b = true,
            element = $('<a>').addClass('annot-link')
              .css({
                position: 'absolute',
                display: 'block',
                left: rect[0],
                top: rect[1],
                width: rect[2],
                height: rect[3]
              })
              .on('mousemove', function()
                {
                  if(this._mousedown)
                    click_b = false;
                })
              .on('mousedown', function(ev)
                {
                  ev.preventDefault();
                  this._mousedown = true;
                })
              .on('mouseup', function(ev)
                {
                  ev.preventDefault();
                  this._mousedown = false;
                  setTimeout(function()
                    {
                      click_b = true;
                    });
                });
            if(data.url)
            {
              element.attr('href', data.url)
                .attr('target', '_blank')
                .click(function()
                  {
                    if(!click_b)
                      return false;
                    var obj = {
                      data: data
                    };
                    self.trigger('openlink', [ obj, page ]);
                    if(obj.return_value !== false)
                      window.open(element.prop('href'), element.attr('target'));
                    return false;
                  });
            }
            else if(data.dest)
            {
              // internal link
              element.attr('href', '#')
                .click(function()
                  {
                    if(!click_b)
                      return false;
                    var obj = {
                      data: data
                    };
                    self.trigger('openlink', [ obj, page ]);
                    if(obj.return_value !== false)
                    {
                      try {
                        var dest = typeof data.dest == 'string' ? 
                          dests[data.dest][0] : data.dest[0];
                        doc.getPageIndex(dest).then(function(index)
                          {
                            self.pdfviewer('openPage', index + 1);
                          });
                      }catch(e) {
                      }
                    }
                    return false;
                  });
            }
            else
            {
              element.attr('href', '#')
                .click(function()
                  {
                    if(!click_b)
                      return false;
                    var obj = {
                      data: data
                    };
                    self.trigger('openlink', [ obj, page ]);
                    return obj.return_value;
                  });
            }
            data.element = element[0];
          }
          return data.element;
        }
        var dests;
        doc.getDestinations().then(function(res)
          {
            dests = res;
          });
        function getAnnotsById(id, annots)
        {
          for(var i = 0, l = annots.length; i < l; ++i)
            if(annots[i].id == id)
              return annots[i];
        }
        if(o.display_links)
        {
          // set links
          for (var i = 0; i < annotationsData.length; i++) {
            var data = annotationsData[i];
            var annotation = PDFJS.Annotation.fromData(data);
            if (!annotation || !annotation.hasHtml()) {
              continue;
            }
            //var element = annotation.getHtmlElement(docPage.commonObjs);
            data = annotation.getData();
            if(data.subtype !== 'Link')
              continue;
            if(page.extra_links)
            {
              if(getAnnotsById(data.id, page.extra_links))
                continue;
            }
            var element = createLink(data);
            $annotationLayerDiv.append(element);
          }
          if(page.extra_links)
          {
            var extra_links = page.extra_links;
            for(var i = 0, l = extra_links.length; i < l; ++i)
            {
              var annot = extra_links[i];
              if(!annot.remove)
                $annotationLayerDiv.append(createLink(annot));
            }
          }
        }
      });
    return promise;
  }
  function update_canvas_object(doc, canvas, o, cb)
  {
    var self = this;
    if(o.cancelRender)
      return o.cancelRender(function()
        {
          update_canvas_object.call(self, doc, canvas, o, cb);
        });
    var $canvas = $(canvas);
    $canvas.dhtml('item_update', dhtml_global_object(o));
    o.cancelRender = function(cb)
    {
      if(renderTask && !canceled)
        renderTask.cancel()
      oncancelEnd = function()
      {
        o.cancelRender = null;
        cb && cb();
      };
      canceled = true;
    }
    var operation_complete = function(cb, err)
    {
      if(canceled)
        return oncancelEnd && oncancelEnd();
      renderTask = null;
      var args = arraySlice.call(arguments, 1);
      cb.apply(null, args);
    },
    canceled,
    renderTask,
    oncancelEnd;

    async.waterfall([
      function(next)
      {
        get_render_pages(doc, canvas, o, function(err, pages)
          {
            o.curPages = pages;
            operation_complete(next, err, pages);
            for(var i = 0; i < pages.length; ++i)
              pages[i].extra_links = [];
            if(!o.silent)
              self.trigger('curPages-changed', [ pages ]);
            typeof o._onCurPagesChange == 'function' && 
              o._onCurPagesChange(pages);
          });
      },
      function(pages, next)
      {
        if(canceled)
          return oncancelEnd && oncancelEnd();
        var ctx = canvas.getContext('2d'),
        render_series = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        var scale = get_view_scale_for_canvas(pages.view, canvas, 'fit'),
        view = pages.view,
        offx = (canvas.width - (view[2] * scale)) / 2,
        offy = (canvas.height - (view[3] * scale)) / 2;
        pages.rect = [ offx, offy, 
                       scale * (view[2] - view[1]), 
                       scale * (view[3] - view[1]) ] ;
        pages.viewport =  new PDFJS.PageViewport(pages.view, scale, 0,
                                                 offx, offy);
        if(!o.silent)
          self.trigger('before-render');

        if(o.links_div)
          $(o.links_div).html('');
        var spare_canvas = newEl('canvas');
        
        $.each(pages, function(i, page)
          {
            var rect = page.rect;
            if(page.docPage)
              render_series.push(function(cb2)
                {
                  var cb = function(err)
                  {
                    operation_complete(cb2, err);
                  };
                  if(canceled)
                    return oncancelEnd && oncancelEnd();
                  var docPage = page.docPage,
                  pview = docPage.view,
                  scale = get_view_scale_for_canvas(view, canvas, 'fit'),
                  offx = (canvas.width - (view[2] - view[0]) * scale) / 2 +
                    page.offset[0] * scale,
                  offy = (canvas.height - (view[3] - view[1]) * scale) / 2 +
                    page.offset[1] * scale;
                  scale = scale * page.scale;
                  var rect = page.rect = [ 
                    Math.floor(offx), Math.floor(offy),
                    Math.ceil(scale * (pview[2] - pview[0])), 
                    Math.ceil(scale * (pview[3] - pview[1])) ] ;
                  viewport = new PDFJS.PageViewport(pview, scale, 0, 0, 0);
                  page.viewport = viewport;
                  async.series([
                    function(cb)
                    {
                      var sctx = spare_canvas.getContext('2d');
                      if(spare_canvas.width != rect[2])
                        spare_canvas.width = rect[2];
                      if(spare_canvas.height != rect[3])
                        spare_canvas.height = rect[3];
                      sctx.clearRect(0, 0, 
                                     spare_canvas.width, spare_canvas.height);
                      renderTask = docPage.render({canvasContext: sctx, 
                                                   viewport: viewport});
                      renderTask.then(function() { callback(); }, callback);
                      function callback(err)
                      {
                        if(!err)
                        {
                          rect[2] += rect[0] > 0 ? 0 : rect[0];
                          rect[3] += rect[0] > 0 ? 0 : rect[0];
                          rect[0] = rect[0] < 0 ? 0 : rect[0];
                          rect[1] = rect[1] < 0 ? 0 : rect[1];
                          if(rect[2] + rect[0] > canvas.width)
                            rect[2] = canvas.width - rect[0];
                          if(rect[3] + rect[1] > canvas.height)
                            rect[3] = canvas.height - rect[1];
                          ctx.drawImage(spare_canvas, rect[0], rect[1]);
                        }
                        cb(err);
                      }
                    },
                    function(cb)
                    {
                      var el = o.links_div;
                      if(el)
                      {  
                        setupAnnotations.call(self, doc, page, rect, 
                                              canvas, $(el))
                          .then(function() { cb() });
                      }
                      else
                        cb();
                    },
                  ], cb);
                });
            });
        
        async.series(render_series, function(err)
          {
            o.cancelRender = null;
            if(!canceled && !o.silent)
              $(self).trigger('render');
            spare_canvas = null;
            next(err);
          });
      }
    ], cb);
  }
  function dhtml_global_object(o)
  {
    return $.extend({
      pdfviewer: o._pdfviewer_ctx
    }, dhtml_global);
  }
  var string = 'string',
  funcStr = 'function',
  isvisible_str = 'isvisible',
  hidden_str = 'hidden',
  pvobj_key = 'pdfviewer-opts',
  viewer = function(opts)
  {
    if(typeof opts == string)
    {
      if(!methods[opts])
        throw new Error("Undefined function: " + opts);
      var args = arraySlice.call(arguments, 1);
      if(singular_methods.indexOf(opts) == -1)
        return this.each(function()
          {
            methods[opts].apply($(this), args);
          });
      else
        return this.length === 0 ? null : methods[opts].apply(this.eq(0), args);
    }
    return this.each(function()
      {
        var $this = $(this),
        popts = $this.data(pvobj_key);
        if(popts && popts._initialized)
          throw new Error("PDF Viewer is already initialized!");
        $this.data(pvobj_key, { _initialized: true });
        methods.setOptions.call($this, $.extend({}, default_opts, opts));
        var o = $this.data(pvobj_key);
        $this.bind('curPages-changed', function()
          {
            selector_update_active_pages.call($this);
          });
        if(!o.canvas)
          set_methods.canvas.call($this, $('canvas.pdfviewer-canvas')[0]);
        if(!o.links_div)
          $this.pdfviewer('set', 'links_div', $('.links-div')[0]);
        methods.bind_move.call($this);
        methods.init_pagecurl.call($this);
        methods.init_page_selector.call($this);
        methods.update_page_selector.call($this);
        methods.init_resize.call($this);
        methods.update_for_theme.call($this);
      });
  },
  set_method_call_update = function(self, o, method)
  {
    if(o._collect_updates)
      o._collect_updates.push(([ self, self.pdfviewer ])
                                .concat(arraySlice.call(arguments, 2)));
    else
      self.pdfviewer.apply(self, arraySlice.call(arguments, 2));
  },
  set_methods = {
    keyboard_shortcut: function(b)
    {
      // keyboard bindings left/right/top/bottom -> prev-page/next-page/zoom-in/zoom-out
      b = !!b;
      var self = this,
      o = self.data(pvobj_key),
      releaser = o._keyboard_shortcut_releaser || [];
      if(b == o.keyboard_shortcut)
        return;
      if(!b)
      {
        funcListCall(releaser);
        o._keyboard_shortcut_releaser = undefined;
        return;
      }
      function zoom_plus(v)
      {
        var cur_zoom = self.pdfviewer('get', 'zoom'),
        zoom = cur_zoom + v,
        el = self[0],
        x = 0.5, y = 0.5;
        if(zoom > 4)
          zoom = 4;
        else if(zoom < 1)
          zoom = 1;
        
        if(cur_zoom > 1 && el)
        {
          x = (el.scrollLeft + self.width()/2) / el.scrollWidth;
          y = (el.scrollTop + self.height()/2) / el.scrollHeight;
        }

        if(cur_zoom != zoom)
          self.pdfviewer('zoomTo', zoom, x, y);
      }
      on($(document), releaser, 'keyup', function(ev)
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
            self.pdfviewer('pagecurl_to', 'previous');
            break;
          case 39: // right arrow
            self.pdfviewer('pagecurl_to', 'next');
            break;
          }
        });
    },
    zoom: function(zoom)
    {
      var self = this,
      o = self.data(pvobj_key);
      o.zoom = zoom;
      self.trigger('sizechanged');
    },
    display_mode: function(mode)
    {
      var self = this,
      o = self.data(pvobj_key);
      o.display_mode = mode;
      if(o.canvas && o.pdfDoc)
        set_method_call_update(self, o, 'update_canvas_object', o.pdfDoc, o.canvas);
    },
    pdfDoc: function(doc)
    {
      var self = this,
      o = self.data(pvobj_key);
      o.pdfDoc = doc;
      set_method_call_update(self, o, 'update_page_selector');
      if(o.canvas)
      {
        if(o.curPageIndex <= 0 || o.curPageIndex > doc.numPages)
          o.curPageIndex = 1;
        set_method_call_update(self, o, 'set_canvas_size', null);
        set_method_call_update(self, o, 'update_canvas_object', doc, o.canvas);
      }
    },
    canvas: function(canvas)
    {
      var self = this,
      o = self.data(pvobj_key);
      if(o.canvas_binds_releaser)
        funcListCall(o.canvas_binds_releaser);
      var releaser = o.canvas_binds_releaser = [],
      $canvas = $(canvas),
      page_sel = self.find('.page-selector'),
      click_timeout_id,
      noclick;
      on($canvas, releaser, 'mousemove', function(ev)
        {
          if(this._mousedown)
            noclick = true;
        })
      ('mousedown', function()
       {
         this._mousedown = true;
       })
      ('mouseup', function()
       {
         this._mousedown = false;
       })
      ('click', function()
       {
         if(noclick)
         {
           noclick = false;
           return false;
         }
         if(click_timeout_id === undefined)
           click_timeout_id = setTimeout(function()
             {
               var win_height = $(window).height();
               if(!page_sel.data(isvisible_str))
                 page_sel.fadeIn(500).data(isvisible_str, true)
                 .trigger('visibility-changed');
               else
                 page_sel.fadeOut(500).data(isvisible_str, false)
                 .trigger('visibility-changed');
               click_timeout_id = undefined;
             }, 200);
         return false;
       })
      ('dblclick', function(ev)
       {
         if(click_timeout_id !== undefined)
         {
           clearTimeout(click_timeout_id);
           click_timeout_id = undefined;
         }
         if(!o.curPages || !o.curPages.rect)
           return;
         var offset = self.offset(),
         rect = o.curPages.rect,
         relX = (ev.pageX - rect[0] - offset.left) / rect[2],
         relY = (ev.pageY - rect[1] - offset.top) / rect[3],
         zoom;
         if(o.zoom > 1)
           zoom = 1;
         else
           zoom = 2;
         self.pdfviewer('zoomTo', zoom, relX, relY);
         return false;
       });
      o.canvas = canvas;
      if(o.pdfDoc)
      {
        set_method_call_update(self, o, 'set_canvas_size', null);
        set_method_call_update(self, o, 'update_canvas_object', o.pdfDoc, canvas);
      }
    }
  },
  get_methods = {
    pageIndexWithOffset: function(offset)
    {
      var o = this.data(pvobj_key),
      curPageIndex = o.curPageIndex,
      curPages = o.curPages;
      if(o.pdfDoc && o.curPages)
      {
        switch(o.display_mode)
        {
        case 'book':
          var off = 1;
          if(o.book_mode_fist_page_odd)
            off = 0;
          curPageIndex -= (curPageIndex - off) % curPages.length;
          if(curPageIndex === 0 && o.book_mode_fist_page_odd)
            curPageIndex = 1;
          break;
        default:
          curPageIndex -= (curPageIndex - 1) % curPages.length;
          
        }
        var page = curPageIndex + curPages.length * offset;
        if(page === 0 && o.display_mode == 'book' && o.book_mode_fist_page_odd)
          page = 1;
        if(page > 0 && page <= o.pdfDoc.numPages)
          return page;
      }
      return false;
    }
  },
  singular_methods = viewer.singular_methods = [ 'get' ],
  methods = viewer.method = {
    loadDocument: function(pdf_url, cb)
    {
      var self = this,
      o = self.data(pvobj_key);
      PDFJS.getDocument(pdf_url, null, null, downloadProgressHandler, {
        onHeadersReceived: function(data)
        {
          self.trigger('headersReceived', [ data ]);
        }
      })
        .then(function(pdf)
        {
          try {
            self.on('render', function()
              {
                if(!o.disable_fade_loadingscreen)
                  $elements_has_target_to($('.pdfviewer-loadingscreen'), 
                                          self[0]).fadeOut();
                self.off('render', arguments.callee);
              });
            self.pdfviewer('set', 'pdfDoc', pdf);
            cb && cb();
          }catch(e) {
            console.error(e);
            cb && cb(e);
          }
        })
        .catch(function(err)
        {
          cb && cb(err);
        });
      function downloadProgressHandler(ev)
      {
        var $els = $elements_has_target_to($('.pdfviewer-progress'), self[0]);
        if($els.data('fadingout'))
          return;
        $els.find('.progress-bar')
          .css('width', (ev.loaded / ev.total * 100) + '%');
        if(ev.loaded >= ev.total)
          $els.fadeOut().data('fadingout', true);
      }
    },
    update_for_theme: function()
    {
      var bkg_color;
      if($('body').hasClass('dark-bkg'))
        bkg_color = '#000000';
      else
        bkg_color = '#ffffff';
      this.pdfviewer('set', 'background', bkg_color);
    },
    init_pagecurl: function()
    {
      var self = this,
      o = self.data(pvobj_key),
      ev_box = {},
      spare_canvases_len = 3,
      spare_canvases = [];
      
      for(var i = 0; i < spare_canvases_len; ++i)
        spare_canvases.push(newEl('canvas'));
      
      self.on('render', pagecurl_start)
        .on('before-render', pagecurl_destroy);
      function pagecurl_destroy()
      {
        $(ev_box).trigger('clear');
      }
      function pagecurl_start()
      {
        for(var i = 0; i < spare_canvases_len; ++i)
        {
          var canvas = spare_canvases[i];
          if(canvas.width != o.canvas.width || 
             canvas.height != o.canvas.height)
          {
            canvas.width = o.canvas.width;
            canvas.height = o.canvas.height;
          }
        }
        render_nearby_pages(function(err, pages_obj)
          {
            if(err)
              return;
            init_pagecurls(pages_obj[0], pages_obj[1], spare_canvases[2]);
            self.trigger('pagecurl-initialized');
          });
      }
      function render_page(args, cb2)
      {
        var idx = args[0],
        spare_canvas = args[1];
        if(!exists(idx))
          return cb2();
        function exists(idx)
        {
          return idx > 0 && idx <= o.pdfDoc.numPages;
        }
        function cb(err)
        {
          $(ev_box).unbind('clear', cancelRender);
          cb2(err, p_opts);
        }
        function cancelRender()
        {
          if(p_opts.cancelRender)
            p_opts.cancelRender();
          cb('Canceled!');
        }
        var p_opts = {
          canvas: spare_canvas,
          curPageIndex: idx,
          display_mode: o.display_mode,
          links_div: o.links_div ? $(o.links_div).clone()[0] : null,
          zoom: o.zoom,
          silent: true,
          book_mode_fist_page_odd: o.book_mode_fist_page_odd,
          _onCurPagesChange: function(pages)
          {
            self.trigger('pagecurl-curPages-changed', [ pages ]);
          }
        };
        $(ev_box).bind('clear', cancelRender);
        update_canvas_object.call(self, o.pdfDoc, spare_canvas, p_opts,
                                  function()
          {
            cb(null, p_opts);
          });
      }
      function render_nearby_pages(cb)
      {
        async.mapSeries([ [ self.pdfviewer('get', 'pageIndexWithOffset', -1), 
                            spare_canvases[0] ],
                          [ self.pdfviewer('get', 'pageIndexWithOffset', 1),
                            spare_canvases[1] ] ], 
                        render_page, cb);
      }
      function init_pagecurls(prev_page_data, next_page_data, spare_canvas)
      {
        var pagecurls = [],
        pagecurl_data = o.pagecurl_data = {},
        display_mode = o.display_mode,
        canvas = o.canvas,
        ctx = canvas.getContext('2d'),
        curPages = o.curPages,
        releaser = [],
        corner_offset = canvas.width/20 < 50 ? 50 : canvas.width/20,
        pc_default_opts = {
          canvas: canvas,
          grabbable: true,
        },
        rendering,
        corner_epsilon_x = 100,
        corner_epsilon_y = 100;
        copy_canvas(spare_canvas, canvas);
        on($(ev_box), releaser, 'clear', destroy);
        pagecurl_data.curlpage = function(pagecurl, cb)
        {
          var curl_corners = [ 'bl', 'br' ];
          for(var i = 0, l = curl_corners.length; i < l; ++i)
          {
            var corner = curl_corners[i];
            if(pagecurl.corners.indexOf(corner) != -1)
            {
              pagecurl.curlpage(corner, cb);
              return true;
            }
          }
          return false;
        }
        function destroy()
        {
          $.each(pagecurls, function(i, pc)
            {
              pc.destroy();
            }); 
          funcListCall(releaser);
          $(o.links_div).show();
          o.pagecurl_data = null;
        }
        function pagecurl_start_handler()
        {
          self.trigger('pagecurl-start');
        }
        function pagecurl_end_handler()
        {
          self.trigger('pagecurl-end');
        }
        function pagecurl_grab()
        {
          $(o.links_div).css('visibility', 'hidden');
          $.each(pagecurls, function(i, pc)
            {
              pc._grabbable = pc.grabbable;
              pc.grabbable = false;
            });
        }
        function pagecurl_grabend()
        {
          $(o.links_div).css('visibility', 'visible');
          $.each(pagecurls, function(i, pc)
            {
              pc.grabbable = pc._grabbable;
            });
        }
        function page_curled()
        {
          // goto next page
          var page_data = this.page_data;
          o.curPageIndex = page_data.curPageIndex;
          o.curPages = page_data.curPages;
          $(o.links_div).replaceWith(page_data.links_div);
          o.links_div = page_data.links_div;
          copy_canvas(spare_canvas, canvas);
          var pages = o.curPages;
          for(var i = 0; i < pages.length; ++i)
            pages[i].extra_links = [];
          self.trigger('curPages-changed', [ o.curPages ]);
          copy_canvas(canvas, spare_canvas, true);
          self.trigger('render');
          pagecurl_destroy();
          pagecurl_start();
        }
        function handle_before_render()
        {
          if(rendering)
            return;
          rendering = true;
          var pc_rendering = this;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          $.each(pagecurls, function(i, pc)
            {
              if(pc != pc_rendering)
                pc.render();
            });
          rendering = false;
        }
        switch(display_mode)
        {
        case 'book':
          var pages_opts = [
            {
              corners: [ 'tl', 'bl', ],
              limits: [ 'tr', 'br' ],
            },
            {
              corners: [ 'tr', 'br' ],
              limits: [ 'tl', 'bl', ]
            }
          ];
          for(var i = 0; i < 2; ++i)
          {
            if(!curPages[i] || !curPages[i].rect)
              continue;
            var curPage = curPages[i],
            rect = curPage.rect,
            page_data = i === 0 ? prev_page_data : next_page_data;
            var pages = page_data ? page_data.curPages : null, 
            rect0 = null, rect1 = null,
            scale = curPage.viewport ? curPage.viewport.scale : 1;
            if(pages)
            {
              rect0 = i === 0 ? pages[0].rect : pages[1].rect;
              rect1 = i === 0 ? pages[1].rect : pages[0].rect;
            }
            var pagecurl = new PageCurl(
              $.extend({}, pages_opts[i], pc_default_opts,{
                page_data: page_data,
                rect: rect,
                src0: rect0 ? {
                  image: page_data.canvas,
                  src_rect: rect0
                } : o.background,
                src1: rect1 ? {
                  image: page_data.canvas,
                  src_rect: rect1
                } : o.background,
                src2: {
                  image: spare_canvas,
                  src_rect: rect
                },
                grabbable: !!pages,
                corner_epsilon_x: corner_epsilon_x * scale,
                corner_epsilon_y: corner_epsilon_y * scale
              }));
            if(i === 0)
              pagecurl_data.previous = pagecurl;
            else
              pagecurl_data.next = pagecurl

            on($(pagecurl), releaser, 'grab', pagecurl_grab)
            ('grabend', pagecurl_grabend)
            ('page-curled', page_curled)
            ('before-render', handle_before_render)
            ('pagecurl-start', pagecurl_start_handler)
            ('pagecurl-end', pagecurl_end_handler);
            
            pagecurls.push(pagecurl);
          }
          break;
        case 'portrait':
          insert_portrait_pagecurl();
          break;
        }
      function insert_portrait_pagecurl()
      {
        var pages_opts = [
          {
            corners: [ 'tl', 'bl', ],
            limits: [ 'tr', 'br' ],
          },
          {
            corners: [ 'tr', 'br' ],
            limits: [ 'tl', 'bl', ]
          }
        ];
        var curPage = curPages[0];
        if(!curPage || !curPage.rect)
          return;
        var rect = curPage.rect;
        for(var i = 0; i < 2; ++i)
        {
          var page_data = i === 0 ? prev_page_data : next_page_data;
          if(!page_data || !page_data.curPages)
            continue;
          var other_page = page_data.curPages[0],
          scale = curPage.viewport ? curPage.viewport.scale : 1,
          pagecurl = new PageCurl(
            $.extend({}, pages_opts[i], pc_default_opts,{
              page_data: page_data,
              rect: rect,
              src0: {
                image: page_data.canvas,
                src_rect: other_page.rect
              },
              src1: o.background,
              src2: {
                image: spare_canvas,
                src_rect: rect
              },
              grabbable: true,
              corner_epsilon_x: corner_epsilon_x * scale,
              corner_epsilon_y: corner_epsilon_y * scale
            }));
          if(i === 0)
            pagecurl_data.previous = pagecurl;
          else
            pagecurl_data.next = pagecurl

          on($(pagecurl), releaser, 'grab', pagecurl_grab)
          ('grabend', pagecurl_grabend)
          ('page-curled', page_curled)
          ('before-render', handle_before_render)
          ('pagecurl-start', pagecurl_start_handler)
          ('pagecurl-end', pagecurl_end_handler);
          
          pagecurls.push(pagecurl);
        }

      }
      }
    },
    pagecurl_to: function(page)
    {
      function continue_job()
      {
        var pagecurl_data = o.pagecurl_data,
        pagecurl = page == 'next' ? pagecurl_data.next : pagecurl_data.previous;
        if(pagecurl && pagecurl.grabbable)
        {
            if(!pagecurl_data.curlpage(pagecurl, function()
                {
                  o.__waiting_for_curlpage = false;
                }))
              o.__waiting_for_curlpage = false;
        }
        else
          o.__waiting_for_curlpage = false;
      }
      var self = this,
      o = self.data(pvobj_key);
      if(o.__waiting_for_curlpage)
        return;
      o.__waiting_for_curlpage = true;
      if(!o.pagecurl_data)
        self.bind('pagecurl-initialized', function()
          {
            continue_job();
            self.unbind('pagecurl-initialized', arguments.callee);
          });
      else
        continue_job();
    },
    init_resize: function()
    {
      var self = this,
      o = self.data(pvobj_key),
      w = self.width(),
      h = self.height(),
      redraw_timeout = 2000,
      redraw_tm,
      zoom = o.zoom,
      dhtml_ctx = [ dhtml_global_object(o) ];
      resize_update();
      if(o.canvas)
        self.pdfviewer('set_canvas_size');
      on($(window), null, 'resize', resize_handle);
      on(self, null, 'sizechanged', sizechanged_handle)
        ('curPages-changed', function init_size_curpages_changed(ev, pages)
          {
            var vp = pdf_viewport_for_canvas(pages.view, {width:w,height:h},
                                             'fit');
            self.pdfviewer('set_canvas_size', vp);
          });
      function sizechanged_handle()
      {
        resize_update();
        if(o.pdfDoc && o.canvas)
          self.pdfviewer('update_canvas_object', o.pdfDoc, o.canvas);
        w = self.width();
        h = self.height();
      }
      function resize_handle(ev)
      {
        if(!o.auto_resizable)
          return;
        resize_update();
        var nw = self.width(),
        nh = self.height();
        if(w != nw || h != nh || zoom != o.zoom)
        {
          if(redraw_tm !== undefined)
            clearTimeout(redraw_tm);
          redraw_tm = setTimeout(function()
            {
              if(o.pdfDoc && o.canvas)
                self.pdfviewer('update_canvas_object', o.pdfDoc, o.canvas);
              else if(o.canvas)
                self.pdfviewer('set_canvas_size');
              redraw_tm = undefined;
            }, redraw_timeout);
        }
        w = nw;
        h = nh;
        zoom = o.zoom;
      }
      function resize_update()
      {
        self.dhtml('eval', self.data('resize'), dhtml_ctx);
        // hack for removing scrollbars
        self.css('overflow', o.zoom > 1 ? '' : 'hidden');
        
        if(o.auto_select_display_mode && o.canvas)
        {
          var mode = o.display_mode,
          canvas = o.canvas,
          width = self.width(),
          height = self.height(),
          rect = o.curPages && o.curPages[0] ? 
            o.curPages[0].rect : null,
          ratio = rect ? 2 * rect[2] / rect[3] : 1.5;
          if(width / height < ratio)
            o.display_mode = 'portrait';
          else
            o.display_mode = 'book';
        }
      }
    },
    set_canvas_size: function(size)
    {
      var self = this,
      o = self.data(pvobj_key),
      canvas = o.canvas;
      if(size)
      {
        canvas.width = Math.max(size.width * o.zoom, self.width());
        canvas.height = Math.max(size.height * o.zoom , self.height());
      }
      else
      {
        canvas.width = self.width() * o.zoom;
        canvas.height = self.height() * o.zoom;
      }
    },
    init_page_selector: function()
    {
      var self = this,
      o = self.data(pvobj_key),
      $el = self.find('.page-selector'),
      releaser = o._page_selector_releaser,
      releaser2 = [],
      pages_prev = $el.find('.pages-preview');
      pages_prev.dhtml('list_init');
      o._page_sel_height = $el.height();
      $el.hide();
      if(releaser)
        funcListCall(releaser);
      releaser = [];
      on($el, releaser, 'click', '.page-item', function()
        {
          var pdfDoc = o.pdfDoc;
          if(!pdfDoc || !o.curPages || this.parentNode._scrolled)
            return false;
          var page_idx = parseInt($(this).data('page-num'));
          if(page_idx > 0 && page_idx <= pdfDoc.numPages)
          {
            self.pdfviewer('openPage', page_idx);
          }
          return false;
        });
      on(pages_prev, releaser, 'scroll', pages_prev_track_visibility)
      ('mousedown', function(ev)
        {
          var self = this;
          self._mousedown = true;
          self._mousedown_data = { mX: ev.pageX, scrollX: this.scrollLeft };
          on($(window), releaser2, 'mouseup', wrpFunc(mouseup_handler, self))
          ('mousemove', wrpFunc(mousemove_handler, self));
          return false;
        })
      ('mouseup', mouseup_handler)
      ('mousemove', mousemove_handler);
      function mousemove_handler(ev)
      {
        var md_data = this._mousedown_data;
        if(this._mousedown)
        {
          this.scrollLeft = md_data.scrollX - (ev.pageX - md_data.mX);
          this._scrolled = true;
        }
        return false;
      }
       function mouseup_handler()
       {
         var self = this;
         funcListCall(releaser2);
         releaser2 = [];
         if(self._mousedown)
         {
           self._mousedown = false;
           setTimeout(function()
             {
               self._scrolled = undefined;
             }, 0);
           return false;
         }
       }
      on($el, releaser, 'visibility-changed', pages_prev_track_visibility);
      pages_prev_track_visibility()
      function pages_prev_track_visibility()
      {
        pages_prev.each(function()
          {
            var $this = $(this),
            width = $this.width(),
            offsetX = $this.offset().left,
            list_visible = $el.data(isvisible_str);
            $this.find(' > li').each(function()
              {
                var $el = $(this),
                offx = $el.offset().left - offsetX,
                w = $el.width(),
                was_visible = $el.data(isvisible_str),
                p0 = offx,
                p1 = offx + w,
                visible = list_visible && w && 
                  ((p0 > 0 && p0 < width) || (p1 > 0 && p1 < width));
                if(visible != was_visible)
                {
                  $el.data(isvisible_str, visible);
                  $el.trigger('visibility-changed');
                }
              });
          });
      }
    },
    bind_move: function()
    {
      var self = this,
      o = self.data(pvobj_key),
      releaser2 = [];
      on(self, null, 'mousedown', function(ev)
        {
          if(!o.moveable)
            return;
          var el = this;
          el._mousedown = true;
          el._mousedown_data = {
            mX: ev.pageX,
            mY: ev.pageY,
            scrollX: el.scrollLeft,
            scrollY: el.scrollTop
          };
          on($(window), releaser2, 'mouseup', wrpFunc(mouseup_handler, el))
          ('mousemove', wrpFunc(mousemove_handler, el));
        })
      ('mousemove', mousemove_handler)
      ('mouseup', mouseup_handler);
      function mousemove_handler(ev)
      {
        if(!o.moveable || self.css('overflow') == 'hidden')
          return;
        // scroll
        var el = this,
        md_data = el._mousedown_data;
        if(el._mousedown)
        {
          el.scrollLeft = md_data.scrollX - (ev.pageX - md_data.mX);
          el.scrollTop = md_data.scrollY - (ev.pageY - md_data.mY);
          el._scrolled = true;
        }
      }
      function mouseup_handler()
      {
        var el = this;
        funcListCall(releaser2);
        releaser2 = [];
        el._mousedown = false;
        setTimeout(function() { el._scrolled = undefined; });
      }
    },
    zoomTo: function(zoom, x, y)
    {
      var self = this,
      o = self.data(pvobj_key);
      self.pdfviewer('set', 'zoom', zoom);
      self.bind('before-render', function()
        {
          var rect = o.curPages ? o.curPages.rect : null;
          if(o.zoom > 1 && rect)
          {
            self.prop('scrollLeft', rect[0] +
                      rect[2] * x - $(window).width()/2);
            self.prop('scrollTop', rect[1] +
                      rect[3] * y - $(window).height()/2);
          }
          else
          {
            self.prop('scrollLeft', 0);
            self.prop('scrollTop', 0);
          }
          self.unbind('before-render', arguments.callee);
        }); 
    },
    openPage: function(index)
    {
      var self = this,
      o = self.data(pvobj_key);
      o.curPageIndex = index;
      if(o.canvas && o.pdfDoc)
        self.pdfviewer('update_canvas_object', o.pdfDoc, o.canvas);
    },
    update_page_selector: function()
    {
      var render_queue = [],
      render_concurrent_tasks = 0,
      render_concurrent_tasks_len = 2;
      function render_queue_add(task)
      {
        if(render_concurrent_tasks >= render_concurrent_tasks_len)
          render_queue.push(task);
        else
        {
          render_concurrent_tasks += 1;
          task();
        }
      }
      function render_queue_remove(task)
      {
        var i = render_queue.indexOf(task);
        if(i != -1)
          render_queue.splice(i, 1);
      }
      function render_queue_task_end()
      {
        var next_task = render_queue.shift();
        if(!next_task)
          render_concurrent_tasks -= 1; 
        else
          next_task();
      }
      function update_page(i)
      {
        var item = {
          draw_page_when_visible: function(type)
          {
            var $canvas = this,
            canvas = $canvas[0],
            rendered, renderTask;
            li.bind('visibility-changed', function(ev)
              {
                var visible = $(this).data(isvisible_str);
                if(!visible && renderTask)
                {
                  renderTask.cancel();
                  renderTask = null;
                  render_queue_task_end();
                }
                else if(visible && !rendered && !renderTask)
                  render_queue_add(draw_page)
                else if(!visible && !rendered && !renderTask)
                  render_queue_remove(draw_page);
              });
            function draw_page()
            {
              pdfDoc.getPage(i).then(function(page)
                {
                  var spare_canvas = newEl('canvas'),
                  spare_ctx = spare_canvas.getContext('2d');
                  spare_canvas.width = canvas.width;
                  spare_canvas.height = canvas.height,
                  viewport = pdf_viewport_for_canvas(page.view, 
                                                     spare_canvas, type);
                  renderTask = page.render({
                    canvasContext: spare_ctx, 
                    viewport: viewport
                  });
                  renderTask.then(function()
                    {
                      var context = canvas.getContext('2d');
                      context.drawImage(spare_canvas, 0, 0);
                      rendered = true;
                      renderTask = null;
                      render_queue_task_end();
                    });
                });
            }
          },
          page_number: i
        };
        var li = pp.dhtml('list_new_item', null);
        li.attr('data-page-num', item.page_number+'');
        pp.append(li);
        li.dhtml('list_items_update', [ item, dhtml_global_object(o) ]);
      }
      var self = this,
      $el = self.find('.page-selector'),
      pp = $el.find('.pages-preview'),
      o = self.data(pvobj_key),
      pdfDoc = o.pdfDoc;
      pp.html('');
      if(!pdfDoc || pp.length === 0)
        return;
      for(var i = 1, len = pdfDoc.numPages; i <= len; ++i)
        update_page(i);
      
      var v = $el.css('display') != 'none';
      if(!v)
        $el.show();
      o._page_sel_height = $el.height();
      if(!v)
        $el.hide();
    },
    update: function()
    {
      var self = this,
      o = self.data(pvobj_key);
      if(o.canvas && o.pdfDoc)
        this.pdfviewer('update_canvas_object', o.pdfDoc, o.canvas);
    },
    reupdate_canvas_object: function(doc, canvas, cb)
    {
      function update()
      {
        self.pdfviewer('update_canvas_object', doc, canvas, cb);
      }
      var self = this,
      o = self.data(pvobj_key); 
      if(o.cancelRender)
        o.cancelRender(update);
      else
        update();
    },
    update_canvas_object: function(doc, canvas, cb)
    {
      var self = this,
      o = self.data(pvobj_key);
      update_canvas_object.call(self, doc, canvas, o, function(err)
        {
          if(err)
            console.error(err);
          cb && cb.apply(self, arguments);
        });
    },
    get: function(prop)
    {
      if(get_methods[prop])
        return get_methods[prop]
                  .apply(this, arraySlice.call(arguments, 1));
      var o = this.data(pvobj_key);
      return o[prop];
    },
    set: function(prop, val)
    {
      if(set_methods[prop])
        return set_methods[prop]
                  .apply(this, arraySlice.call(arguments, 1));
      var o = this.data(pvobj_key);
      return o[prop] = val;
    },
    setOptions: function(opts)
    {
      var o = this.data(pvobj_key);
      var funcs = o._collect_updates = [];
      for(var i in opts)
        methods.set.call(this, i, opts[i]);

      var unique_names = [],
      tmp = [];
      for(var c = funcs.length - 1; c >= 0; --c)
      {
        var func = funcs[c];
        if(unique_names.indexOf(func[2]) == -1)
          tmp.unshift(func);
        unique_names.push(func[2]);
      }
      funcListCall(tmp);
      o._collect_updates = null;
    }
  };
  
  viewer.pageRectToDocPageRect = pageRectToDocPageRect;
  viewer.docPageRectToPageRect = docPageRectToPageRect;
  $.fn.pdfviewer = viewer;
  function control_button_enable_toggle_visibility_on_hover($el, epx, epy)
  {
    show_$el(false, $el);
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
        var tmp = $el.css('display');
        $el.css('display', 'block');
        var vb = true,
        eloff = $el.offset(),
        width = $el.width(),
        height = $el.height();
        $el.css('display', tmp);
        if(epx && !isNaN(epx))
          vb = vb && Math.abs(eloff.left + width/2 - ev.pageX) < epx;
        if(epy && !isNaN(epy))
          vb = vb && Math.abs(eloff.top + height/2 - ev.pageY) < epy;
        show_$el(vb, $el);
      });
  }
  $.fn.pdfviewer_controls = function()
  {
    var self = this;
    $('.next-btn', self).click(function()
      {
        var target_str = $(this).data('target');
        if(target_str)
        {
          $(target_str).pdfviewer('pagecurl_to', 'next');
          return false;
        }
      });
    $('.previous-btn', self).click(function()
      {
        var target_str = $(this).data('target');
        if(target_str)
        {
          $(target_str).pdfviewer('pagecurl_to', 'previous');
          return false;
        }
      });

    // show pdfviewer left/right arrow when cursor is near it
    $(' > *', self).each(function()
      {
        var $el = $(this),
        epsilonX = 100;
        if(typeof $el.attr('data-show-on-hover') !== 'undefined')
          control_button_enable_toggle_visibility_on_hover($el, epsilonX, null)
      });
  }
  $(function(){
    $('.pdfviewer').pdfviewer();
    $('.pdfviewer-controls').pdfviewer_controls();
  });
})(jQuery);
