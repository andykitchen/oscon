#include <stddef.h>

void gray2rgba(size_t len, unsigned char *in, unsigned char *out) {
	for(int i = 0; i < len; i++) {
		out[4*i]     = in[i];
		out[4*i + 1] = in[i];
		out[4*i + 2] = in[i];
		out[4*i + 3] = 255;
	}
}

void rgb2rgba(size_t len, unsigned char *in, unsigned char *out) {
	for(int i = 0; i < len; i++) {
		out[4*i]     = in[3*i];
		out[4*i + 1] = in[3*i + 1];
		out[4*i + 2] = in[3*i + 2];
		out[4*i + 3] = 255;
	}
}
