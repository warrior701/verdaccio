// @flow

import request from 'supertest';
import _ from 'lodash';
import path from 'path';
import rimraf from 'rimraf';

import endPointAPI from '../../../../src/api';
import {mockServer} from '../../__helper/mock';
import {parseConfigFile} from '../../../../src/lib/utils';
import {parseConfigurationFile} from '../../__helper';
import {getNewToken, getProfile, postProfile} from '../../__helper/api';
import {setup} from '../../../../src/lib/logger';
import {API_ERROR, HTTP_STATUS, SUPPORT_ERRORS} from '../../../../src/lib/constants';

setup([]);

const parseConfigurationProfile = () => {
  return parseConfigurationFile(`profile/profile`);
};


describe('endpoint user profile', () => {
  let app;
  let mockRegistry;

  beforeAll(function(done) {
    const store = path.join(__dirname, '../../partials/store/test-profile-storage');
    const mockServerPort = 55544;
    rimraf(store, async () => {
      const parsedConfig = parseConfigFile(parseConfigurationProfile());
      const configForTest = _.assign({}, _.cloneDeep(parsedConfig), {
        storage: store,
        auth: {
          htpasswd: {
            file: './test-profile-storage/.htpasswd-auth-profile'
          }
        },
        self_path: store
      });
      app = await endPointAPI(configForTest);
      mockRegistry = await mockServer(mockServerPort).init();
      done();
    });
  });

  afterAll(function(done) {
    mockRegistry[0].stop();
    done();
  });

  test('should fetch a profile of logged user', async (done) => {
    const credentials = { name: 'JotaJWT', password: 'secretPass' };
    const token = await getNewToken(request(app), credentials);
    const [err1, res1] = await getProfile(request(app), token);

    expect(err1).toBeNull();
    expect(res1.body.name).toBe(credentials.name);
    done();
  });

  describe('change password', () => {
    test('should change password successfully', async (done) => {
      const credentials = { name: 'userTest2000', password: 'secretPass000' };
      const body = {
        password: {
          new: '12345678',
          old: credentials.password,
        }
      };
      const token = await getNewToken(request(app), credentials);
      const [err1, res1] = await postProfile(request(app), body, token);

      expect(err1).toBeNull();
      expect(res1.body.name).toBe(credentials.name);
      done();
    });

    test('should change password is too short', async (done) => {
      const credentials = { name: 'userTest2001', password: 'secretPass001' };
      const body = {
        password: {
          new: 'p1',
          old: credentials.password,
        }
      };
      const token = await getNewToken(request(app), credentials);
      const [, resp] = await postProfile(request(app), body, token, HTTP_STATUS.UNAUTHORIZED);

      expect(resp.error).not.toBeNull();
      expect(resp.error.text).toMatch(API_ERROR.PASSWORD_SHORT());
      done();
    });
  });

  describe('change tfa', () => {
    test('should report TFA is disabled', async (done) => {
      const credentials = { name: 'userTest2002', password: 'secretPass002' };
      const body = {
        tfa: {}
      };
      const token = await getNewToken(request(app), credentials);
      const [, resp] = await postProfile(request(app), body, token, HTTP_STATUS.SERVICE_UNAVAILABLE);

      expect(resp.error).not.toBeNull();
      expect(resp.error.text).toMatch(SUPPORT_ERRORS.TFA_DISABLED);
      done();
    });
  });

  describe('error handling', () => {
    test('should forbid to fetch a profile with invalid token', async (done) => {
      const [, resp] = await getProfile(request(app), `fakeToken`, HTTP_STATUS.UNAUTHORIZED);

      expect(resp.error).not.toBeNull();
      expect(resp.error.text).toMatch(API_ERROR.MUST_BE_LOGGED);
      done();
    });

    test('should forbid to update a profile with invalid token', async (done) => {
      const [, resp] = await postProfile(request(app), {}, `fakeToken`, HTTP_STATUS.UNAUTHORIZED);

      expect(resp.error).not.toBeNull();
      expect(resp.error.text).toMatch(API_ERROR.MUST_BE_LOGGED);
      done();
    });
  });
});
