#!/usr/bin/python
#
# convert .po to .properties
#

import optparse
import os
import polib
import re
import string
import sys

def pescape_key(orig):
	
	result = ""
	if orig[0] == '#' or orig[0] == '!':
		result = result + "\\"
		
	for ch in orig:
		if ch == ':':
			result = result + "\\:"
		elif ch == '=':
			result = result + "\\="
		elif ch == '\r':
			result = result + "\\r"
		elif ch == '\n':
			result = result + "\\n"
		elif ord(ch) > 128:
			val = ord(ch)
			result = result + "\\u%04X" % val
		elif string.whitespace.find(ch) != -1:
			result = result + "\\" + ch;
		else:
			result = result + ch
			
	return result
	
def pescape_value(orig):
	result = ""
	for ch in orig:
		if ch == ':':
			result = result + "\\:"
		elif ch == '=':
			result = result + "\\="
		elif ch == '\r':
			result = result + "\\r"
		elif ch == '\n':
			result = result + "\\n"
		elif ord(ch) > 128:
			val = ord(ch)
			result = result + "\\u%04X" % val
		else:
			result = result + ch
			
	return result
	

parser = optparse.OptionParser(usage="usage: %prog [options] pofile...")
parser.add_option("--quiet", action="store_false", default=True, dest="verbose", help="don't print status messages to stdout")

(options, args) = parser.parse_args()

if args == None or len(args) == 0:
	print("ERROR: you must specify at least one po file to translate");
	sys.exit(1)

paramFix = re.compile("(\\(([0-9])\\))")

for srcfile in args:

	destfile = os.path.splitext(srcfile)[0] + ".properties"
	
	print("INFO: converting %s to %s" % (srcfile, destfile))
	
	dest = open(destfile, "w")
	
	dest.write("# converted with po2prop\n");
	
	po = polib.pofile(srcfile, autodetect_encoding=False, encoding="utf-8", wrapwidth=-1)
	for entry in po:
		if entry.obsolete or entry.msgstr == '' or entry.msgstr == entry.msgid:
			continue
			
		dest.write("%s=%s\n" % (pescape_key(entry.msgid), pescape_value(entry.msgstr)))
			
	dest.close()

