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

cleanup-dist:
	test -d ${MAKEFILE_DIR}/dist && rm -r ${MAKEFILE_DIR}/dist

build: cleanup-dist
	yarn run build

build-dev: cleanup-dist
	yarn run dev:build

publish: build
	yarn publish --access public
