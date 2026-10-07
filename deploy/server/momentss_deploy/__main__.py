import argparse
import logging
import sys

from .config import load_config
from .download import NoRelease
from .update import rollback, update


def main():
    parser = argparse.ArgumentParser(description='Download and activate the latest MomentSS release')
    parser.add_argument('--config', required=True)
    parser.add_argument('--rollback', metavar='TAG', help='Activate a retained local release')
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')
    try:
        config = load_config(args.config)
        config.root.mkdir(parents=True, exist_ok=True)
        # Linux flock also protects manual runs from overlapping with the timer.
        import fcntl
        with (config.root / '.deploy.lock').open('a') as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                logging.info('Another update is running; skip')
                return 0
            if args.rollback:
                rollback(config, args.rollback)
            else:
                update(config)
    except NoRelease as error:
        logging.info('%s; retry on the next timer run', error)
        return 0
    except Exception:
        logging.exception('Update failed; inspect the error and the current link')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
