.PHONY: run build linux amd64 arm64 release clean check

SUBDIR := webview

run:
	$(MAKE) -C $(SUBDIR) run

build linux amd64 arm64 release check:
	$(MAKE) -C $(SUBDIR) $@

clean:
	$(MAKE) -C $(SUBDIR) clean