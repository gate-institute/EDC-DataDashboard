/*
 *  Copyright (c) 2025 Fraunhofer-Gesellschaft zur Förderung der angewandten Forschung e.V.
 *
 *  This program and the accompanying materials are made available under the
 *  terms of the Apache License, Version 2.0 which is available at
 *  https://www.apache.org/licenses/LICENSE-2.0
 *
 *  SPDX-License-Identifier: Apache-2.0
 *
 *  Contributors:
 *       Fraunhofer-Gesellschaft zur Förderung der angewandten Forschung e.V. - initial API and implementation
 *
 */

import { Injectable, inject } from '@angular/core';
import { DashboardStateService, EdcClientService } from '@eclipse-edc/dashboard-core';
import { Asset, AssetInput, IdResponse } from '@think-it-labs/edc-connector-client';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/**
 * Service to manage and retrieve assets.
 */
@Injectable({
  providedIn: 'root',
})
export class AssetService {
  private readonly http = inject(HttpClient);
  private readonly stateService = inject(DashboardStateService);
  private readonly edc = inject(EdcClientService);

  /**
   * Retrieves all assets from the management API.
   * @returns A promise that resolves to an array of assets.
   */
  public async getAllAssets(): Promise<Asset[]> {
    const client = await this.edc.getClient();
    return client.management.assets.queryAll();
  }

  public async createAsset(assetInput: AssetInput): Promise<IdResponse> {
  //  return (await this.edc.getClient()).management.assets.create(assetInput);
    const { url, options } = await this.assetEndpoint();
    return firstValueFrom(this.http.post<IdResponse>(url, assetInput, options));
  }
 
  public async updateAsset(assetInput: AssetInput): Promise<void> {
    //return (await this.edc.getClient()).management.assets.update(assetInput);
    const { url, options } = await this.assetEndpoint();
    return (await firstValueFrom(this.http.put<void>(url, assetInput, options)));
  }
  
  public async deleteAsset(id: string): Promise<void> {
    return (await this.edc.getClient()).management.assets.delete(id);
  
  }

  private async assetEndpoint() {
    const config = await firstValueFrom(this.stateService.currentEdcConfig$);
    if (!config) {
      throw new Error('No EDC configuration available.');
    }

    return {
      url: `${config.managementUrl}/v4/assets`,
      options: {
        headers: config.apiToken ? { 'x-api-key': config.apiToken } : undefined,
      },
    };
  }

}
