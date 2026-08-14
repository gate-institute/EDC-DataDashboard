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

import { Component, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { Asset, compact, EdcConnectorClientError, IdResponse } from '@think-it-labs/edc-connector-client';
import { NgClass } from '@angular/common';
import { AssetService } from '../asset.service';
import {
  AlertComponent,
  DataAddressFormComponent,
  DataplaneMetadataFormValue,
  DataTypeInputComponent,
  JsonObjectInputComponent,
  JsonObjectTableComponent,
} from '@eclipse-edc/dashboard-core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { JsonValue } from '@angular-devkit/core';

@Component({
  selector: 'lib-asset-create',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    JsonObjectTableComponent,
    NgClass,
    DataTypeInputComponent,
    JsonObjectInputComponent,
    DataAddressFormComponent,
  ],
  templateUrl: './asset-create.component.html',
  styleUrl: './asset-create.component.css',
})
export class AssetCreateComponent implements OnChanges {
  private readonly assetService = inject(AssetService);
  private readonly formBuilder = inject(FormBuilder);

  @Input() asset?: Asset;
  @Output() created = new EventEmitter<IdResponse>();
  @Output() updated = new EventEmitter<void>();
  mode: 'create' | 'update' = 'create';

  errorMsg = '';

  properties: Record<string, JsonValue> = {};
  privateProperties: Record<string, JsonValue> = {};
  customHeaders: Record<string, JsonValue> = {};
  dataplaneMetadata?: DataplaneMetadataFormValue;

  assetForm: FormGroup;

  constructor() {
    this.assetForm = this.formBuilder.group({
      id: [''],
      name: [''],
      description: [''],
      contenttype: [''],
    });
  }

  async ngOnChanges() {
    if (this.asset) {
      this.mode = 'update';
      await this.updateAssetAndSyncForm();
      this.assetForm.get('id')?.disable();
    }
  }

  private async updateAssetAndSyncForm() {
    this.properties = await compact(this.asset!.properties);
    this.privateProperties = await compact(this.asset!.privateProperties);
    this.assetForm.get('id')?.setValue(this.asset!.id);
    this.assetForm.get('name')?.setValue(this.properties['name']);
    this.assetForm.get('description')?.setValue(this.properties['description']);
    this.assetForm.get('contenttype')?.setValue(this.properties['contenttype']);

    const dpm = await this.compactDataplaneMetadata();
    this.customHeaders = {};
    if (dpm) {
      this.customHeaders = this.extractCustomHeaders(dpm);

      this.dataplaneMetadata = {
        type: dpm['type'] || 'HttpData',
        method: dpm['method'] || 'GET',
        url: dpm['url'],
        ttl: dpm['ttl'] || 600,
        authType: this.authType(dpm),
        username: dpm['auth.username'] || '',
        password: dpm['auth.password'] || '',
        apiKey: dpm['header:X-API-Key'] || '',
      };
    }
  }

  createAsset(): void {
    if (this.assetForm.valid) {
      let assetInput: any;

      try {
        assetInput = this.createAssetInput();
      } catch (err) {
        this.errorMsg = err instanceof Error ? err.message : String(err);
        return;
      }
      if (this.mode === 'create') {
        this.assetService
          .createAsset(assetInput)
          .then((idResponse: IdResponse) => {
            this.created.emit(idResponse);
          })
          .catch((err: EdcConnectorClientError) => {
            this.errorMsg = err.message;
          });
      } else if (this.mode === 'update') {
        this.assetService
          .updateAsset(assetInput)
          .then(() => this.updated.emit())
          .catch((err: EdcConnectorClientError) => (this.errorMsg = err.message));
      }
    } else {
      console.error('Create asset called with invalid form');
    }
  }

  private createAssetInput(): any {
    const formValue = this.assetForm.getRawValue();
    const dataplaneMetadata = this.createDataplaneMetadataProperties(
      this.assetForm.get('dataplaneMetadata')?.value as DataplaneMetadataFormValue,
      this.customHeaders,
    );

    const asset: any = {
      '@context': ['https://w3id.org/edc/connector/management/v2'],
      '@type': 'Asset',
      properties: {
        ...this.properties,
      },
      privateProperties: {
        ...this.privateProperties,
      },
      dataplaneMetadata: {
        '@type': 'DataplaneMetadata',
        properties: dataplaneMetadata,
      },
    };

    if (formValue.id) {
      asset['@id'] = formValue.id;
    }
    if (formValue.name) {
      asset.properties['name'] = formValue.name;
    }
    if (formValue.description) {
      asset.properties['description'] = formValue.description;
    }
    if (formValue.contenttype) {
      asset.properties['contenttype'] = formValue.contenttype;
    }

    return asset;
  }

  private createDataplaneMetadataProperties(
    dpm?: DataplaneMetadataFormValue,
    customHeaders: Record<string, JsonValue> = {},
  ): Record<string, JsonValue> {
    if (!dpm?.url) {
      throw new Error('url is required');
    }

    const url = dpm.url.trim();
    const properties: Record<string, JsonValue> = {
      type: dpm?.type || 'HttpData',
      method: dpm?.method || 'GET',
      url,
      ttl: Number(dpm?.ttl ?? 600),
    };

    if (dpm?.authType === 'basic') {
      properties['auth.type'] = 'basic';
      properties['auth.username'] = dpm.username!;
      properties['auth.password'] = dpm.password!;
    } else if (dpm?.authType === 'apiKey') {
      properties['header:X-API-Key'] = dpm.apiKey!;
    }

    Object.entries(customHeaders).forEach(([key, value]) => {
      if (!key || value == null || value === '') {
        return;
      }

      if (!this.isValidHeaderName(key)) {
        throw new Error(`Invalid HTTP header name: ${key}`);
      }

      properties[`header:${key}`] = value;
    });

    return properties;
  }

  private isValidHeaderName(name: string): boolean {
    return /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name);
  }

  private extractCustomHeaders(metadata: Record<string, JsonValue>): Record<string, JsonValue> {
    return Object.fromEntries(
      Object.entries(metadata)
        .filter(([key]) => key.startsWith('header:') && key !== 'header:X-API-Key')
        .map(([key, value]) => [key.substring('header:'.length), value] as const),
    );
  }

  private async compactDataplaneMetadata(): Promise<Record<string, any> | undefined> {
    if (!this.asset) {
      return undefined;
    }

    const compacted = await compact(this.asset);
    const dpm = compacted.dataplaneMetadata;

    if (!dpm) {
      return undefined;
    }

    return dpm.properties?.['@value'];
  }

  private authType(metadata: Record<string, any>): 'none' | 'basic' | 'apiKey' {
    if (metadata['auth.type'] === 'basic') {
      return 'basic';
    }

    if (metadata['header:X-API-Key']) {
      return 'apiKey';
    }

    return 'none';
  }

}
