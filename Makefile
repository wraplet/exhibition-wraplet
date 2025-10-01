.ONESHELL:
.PHONY: $(MAKECMDGOALS)
SHELL = /bin/bash

MAKEFILE_DIR := $(shell dirname $(abspath $(lastword $(MAKEFILE_LIST))))

lint-fix:
	yarn run lint:fix

lint:
	yarn run lint

tests:
	yarn run tests

build:
	rm -r ${MAKEFILE_DIR}/dist/*
	yarn run build

publish: build
	yarn publish --access public
