from flask import jsonify

def register_error_handlers(app):
    @app.errorhandler(Exception)
    def handle_exception(error):
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Application error: {error}")
        return jsonify({'error': str(error)}), 500
