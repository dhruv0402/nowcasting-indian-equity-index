.PHONY: setup ingest features model backtest pipeline dashboard test report clean

PYTHON = python3

setup:
	$(PYTHON) -m pip install -r requirements.txt
	mkdir -p data/raw data/processed reports

ingest:
	$(PYTHON) run_pipeline.py --stage ingest

features:
	$(PYTHON) run_pipeline.py --stage features

model:
	$(PYTHON) run_pipeline.py --stage model

backtest:
	$(PYTHON) run_pipeline.py --stage backtest

pipeline:
	$(PYTHON) run_pipeline.py --stage all

pipeline-synthetic:
	$(PYTHON) run_pipeline.py --stage all --use-synthetic

dashboard:
	streamlit run src/dashboard/app.py

test:
	pytest tests/ -v

report:
	$(PYTHON) run_pipeline.py --stage report

clean:
	rm -rf data/raw/* data/processed/* data/db.sqlite reports/*.md
