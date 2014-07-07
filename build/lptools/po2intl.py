#!/usr/bin/python
#
# makes a test .po with "international" version of all text
#

import international
import optparse
import os
import polib
import re
import string
import sys

parser = optparse.OptionParser(usage="usage: %prog [options] pofile...")
parser.add_option("--quiet", action="store_false", default=True, dest="verbose", help="don't print status messages to stdout")

(options, args) = parser.parse_args()

if args == None or len(args) == 0:
	print("ERROR: you must specify at least one .po file to convert");
	sys.exit(1)

for srcfile in args:

	destfile = os.path.splitext(srcfile)[0] + "-intl.po"
	
	if options.verbose:
		print("INFO: converting %s to %s" % (srcfile, destfile))
	
	po = polib.pofile(srcfile, autodetect_encoding=False, encoding="utf-8", wrapwidth=-1)
	destpo = polib.POFile()
	count = 0
	for entry in po:
		if entry.obsolete:
			continue
			
		if len(entry.msgstr) > 0:
			text = entry.msgstr
		else:
			text = entry.msgid
			
		if len(text) == 0:
			continue
			
		intl_entry = polib.POEntry(msgid=text, msgstr=international.to_international(text))
		destpo.append(intl_entry)
		count += 1

	if options.verbose:
		print("INFO: %d phrases converted" % count)
		
	destpo.save(destfile)
	
	if options.verbose:
		print("INFO: %s saved" % destfile)