#!/usr/bin/python
#
# encodes a string into "international" (all characters with some sort of accent mark)
#

import os
import re

#
# initialize mapping from file
#
mapping = dict()
f= open(os.path.join(os.path.dirname(__file__), "international.properties"), "r")
for line in f:
	line = line.strip()

	if len(line) == 0:
		continue
		
	if line[0] in ( '!', '#' ):
		continue
		
	equals = line.find('=')
	if equals <= 0:
		continue
		
	key = line[0:equals]
	value = unichr(int(line[equals+1:], 16))
	
	mapping[key]= value
	
f.close()

def to_international_text(text):

	result = ''
	in_brace = False
	for ch in text:
		if ch == '{':
			in_brace = True
			result += ch
		elif ch == '}':
			in_brace = False
			result += ch
		elif in_brace == False and ch in mapping:
			result += mapping[ch]
		else:
			result += ch

	return result

# based on the snippet at http://unethicalblogger.com/node/180
import HTMLParser
class international_parser(HTMLParser.HTMLParser):
	def __init__(self, *args, **kwargs):
		HTMLParser.HTMLParser.__init__(self)
		self.stack = []
		
	def handle_starttag(self, tag, attrs):
		attrs = dict(attrs)
		self.stack.append(self.__html_start_tag(tag, attrs))
		
	def handle_endtag(self, tag):
		self.stack.append(self.__html_end_tag(tag))
			
	def handle_startendtag(self, tag, attrs):
		self.stack.append(self.__html_startend_tag(tag, attrs))
		
	def handle_data(self, data):
		self.stack.append(to_international_text(data))
		
	def __html_start_tag(self, tag, attrs):
		return '<%s%s>' % (tag, self.__html_attrs(attrs))
		
	def __html_startend_tag(self, tag, attrs):
		return '<%s%s/>' % (tag, self.__html_attrs(attrs))
		
	def __html_end_tag(self, tag):
		return '</%s>' % (tag)
		
	def attr_to_str(self, attr, value):
		if attr in ['alt', 'title']:
			return '%s="%s"' % (attr, to_international_text(value))
		else:
			return '%s="%s"' % (attr, value)
			
	def __html_attrs(self, attrs):
		#print attrs
		_attrs = ''
		if attrs:
			if isinstance(attrs, list):
				for attr in attrs:
					_attrs += ' %s' % self.attr_to_str(attr[0], attr[1])
			else:
				for attr in attrs.keys():
					_attrs += ' %s' % self.attr_to_str(attr, attrs[attr])
		return _attrs
		
		
		
	@classmethod
	def to_international(cls, markup):
		_p = cls()
		_p.feed(markup)
		_p.close()
		return ''.join(_p.stack)

def to_international_html(text):
	
	parser = international_parser()
	
	result = parser.to_international(text)
	
	return result

# deliberately primitive: snippets to translate can be very fragmented
html_re = re.compile("([^<]*<[^>]+>[^<]*)+")

def to_international(text):

	if html_re.match(text):
		return to_international_html(text)
	else:
		return to_international_text(text)
	
if __name__ == "__main__":
	tests = ['simple', 'longer', 
		'very long with lots of stuff', 
		'with numbers 867-5309', 
		'with !mappable# works?', 
		'<b>html test</b>', 
		'<a href="link">click here</a>', 
		'<img src="image" alt="alttext"/>', 
		'before <b> during </b> after',
		'<a href="link" title="tooltip">text</a>',
		'before <img src="src" alt="alttext" title="tooltip" > after',
		'<span title="tooltip">text</span>',
		'some<br/>multiline<br>text<br/>with various<br>linefeed styles'
		]
	
	for test in tests:
		print("'%s' => '%s'" % (test, to_international(test)))
