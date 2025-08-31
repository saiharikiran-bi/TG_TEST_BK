import AssetDB from '../models/AssetDB.js';

export const getAllAssets = async (req, res) => {
    try {
        const userLocationId = req.user?.locationId;
        const assets = await AssetDB.getAllAssets(userLocationId);
        res.json({
            success: true,
            data: assets,
            message: 'Hierarchical assets retrieved successfully',
            userLocation: userLocationId,
            filteredByLocation: !!userLocationId
        });
    } catch (error) {
        console.error('Error fetching hierarchical assets:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch hierarchical assets',
            error: error.message
        });
    }
};

export const addAsset = async (req, res) => {
    try {
        // Use validated data from middleware
        const assetData = req.validatedData;
        const userLocationId = req.user?.locationId;

        // Assign user's location to the new asset if available
        if (userLocationId) {
            assetData.locationId = userLocationId;
        }
        
        console.log('Adding asset with data:', assetData);
        
        const result = await AssetDB.addAsset(assetData);
        
        // Return appropriate response based on result status
        if (result.status === 'warning') {
            return res.status(200).json({
                success: true,
                data: result,
                message: result.message,
                warning: true,
                userLocation: userLocationId,
                filteredByLocation: !!userLocationId
            });
        }
        
        res.json({
            success: true,
            data: result,
            message: result.message,
            userLocation: userLocationId,
            filteredByLocation: !!userLocationId
        });
    } catch (error) {
        console.error('Error adding asset:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add asset',
            error: error.message
        });
    }
};

export const bulkUploadAssets = async (req, res) => {
    try {
        // Use validated data from middleware
        const { assets } = req.validatedData;
        const userLocationId = req.user?.locationId;

        // Assign user's location to all assets if available
        if (userLocationId) {
            assets.forEach(asset => {
                asset.locationId = userLocationId;
            });
        }

        const result = await AssetDB.bulkUploadAssets(assets);
        res.json({
            success: true,
            data: result,
            message: result.message,
            userLocation: userLocationId,
            filteredByLocation: !!userLocationId
        });
    } catch (error) {
        console.error('Error bulk uploading assets:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to bulk upload assets',
            error: error.message
        });
    }
}; 