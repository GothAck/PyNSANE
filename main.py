from threading import Lock
from collections import defaultdict
from io import BytesIO
from functools import wraps, update_wrapper
from datetime import datetime
from contextlib import contextmanager

from flask import Flask, render_template, request, jsonify, send_file, make_response

import sane

app = Flask(__name__)

print(dir(sane.Option))

TYPE_STR = sane.TYPE_STR
print(TYPE_STR)
UNIT_STR = sane.UNIT_STR
print(UNIT_STR)

lock = Lock()
device_locks = defaultdict(Lock)


def nocache(view):
    @wraps(view)
    def no_cache(*args, **kwargs):
        response = make_response(view(*args, **kwargs))
        response.headers['Last-Modified'] = datetime.now()
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '-1'
        return response

    return update_wrapper(no_cache, view)


@contextmanager
def get_device_lock(device_id):
    with lock:
        device_lock = device_locks[device_id]
    try:
        yield device_lock
    finally:
        pass


def with_sane(view):
    @wraps(view)
    def with_sane(*args, **kwargs):
        try:
            sane.init()
            return view(*args, **kwargs)
        finally:
            sane.exit()
    return update_wrapper(with_sane, view)


@app.route('/')
def home():
    return render_template('home.html.jinja')


@app.route('/devices')
@with_sane
def devices():
    with lock:
        return jsonify(sane.get_devices(True))


@app.route('/device/<name>/options')
@with_sane
def device_options(name):
    with get_device_lock(name):
        dev = sane.open(name)
        opts = [
            {
                key: value
                for key, value in dev[opt].__dict__.items()
                if key in
                ('py_name', 'title', 'desc', 'type', 'unit', 'constraint')
            }
            for opt in dev.optlist
            if 'button' not in opt and dev[opt].is_active() and dev[opt].is_settable()
        ]
        for opt in opts:
            opt['type'] = TYPE_STR[opt['type']]
            opt['unit'] = UNIT_STR[opt['unit']]
            opt['constraint_type'] = \
                'range' if isinstance(opt['constraint'], tuple) else 'list'
            opt['value'] = getattr(dev, opt['py_name'])
        data = jsonify(opts)
        dev.close()
        return data


@app.route('/device/<name>/scan')
@nocache
@with_sane
def device_scan(name):
    with get_device_lock(name):
        dev = sane.open(name)

        for key, value in reversed(list(request.args.items())):
            print(key, value)
            if dev[key].type in (0, 1):
                value = int(value)
            elif dev[key].type == 2:
                value = float(value)
            setattr(dev, key, value)

        dev.start()
        img = dev.snap()
        dev.close()
        img_io = BytesIO()
        img.save(img_io, 'jpeg', quality=90)
        img_io.seek(0)
        return send_file(img_io, 'image/jpeg')

